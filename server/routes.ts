import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { isAuthenticated, requireAdmin, optionalAuth } from "./auth";
import { authStorage, normalizePhone } from "./auth/storage";
import {
  isRazorpayConfigured,
  getRazorpayKeyId,
  createRazorpayOrder,
  verifyPaymentSignature,
} from "./razorpay";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/products", async (_req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    const reviews = await storage.getReviewsByProduct(Number(req.params.id));
    res.json(reviews);
  });

  app.post("/api/products/:id/reviews", async (req, res) => {
    try {
      const reviewSchema = z.object({
        customerName: z.string().min(1),
        rating: z.number().min(1).max(5),
        comment: z.string().min(1),
      });
      const data = reviewSchema.parse(req.body);
      const review = await storage.createReview({
        productId: Number(req.params.id),
        ...data,
      });
      res.json(review);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/promotions", async (_req, res) => {
    const promos = await storage.getPromotions();
    res.json(promos);
  });

  app.post("/api/orders", optionalAuth, async (req, res) => {
    try {
      const orderSchema = z.object({
        customerName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        address: z.string().min(1),
        city: z.string().min(1),
        pincode: z.string().min(1),
        items: z.array(z.object({
          productId: z.number(),
          name: z.string(),
          size: z.string(),
          price: z.number(),
          quantity: z.number().min(1),
        })).min(1),
        subtotal: z.number().min(0),
        discount: z.number().min(0),
        total: z.number().min(0),
        paymentMethod: z.enum(["upi", "razorpay"]),
      });
      const data = orderSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || null;
      const order = await storage.createOrder({ ...data, userId });

      // Auto-link phone/email to user account on first use
      if (user) {
        const normalizedPhone = normalizePhone(data.phone);
        if (!user.phone && normalizedPhone.length >= 10) {
          await authStorage.linkPhone(user.id, normalizedPhone).catch(() => {});
        }
        if (!user.email && data.email) {
          await authStorage.linkEmail(user.id, data.email).catch(() => {});
        }

        // Auto-save address if not already stored for this user
        try {
          const existingAddrs = await storage.getAddressesByUserId(user.id);
          const alreadySaved = existingAddrs.some(
            (a) =>
              a.addressLine1.toLowerCase() === data.address.toLowerCase() &&
              a.pincode === data.pincode
          );
          if (!alreadySaved) {
            await storage.createAddress({
              userId: user.id,
              label: "Home",
              recipientName: data.customerName,
              phone: normalizedPhone,
              addressLine1: data.address,
              addressLine2: null,
              city: data.city,
              state: "",
              pincode: data.pincode,
              country: "India",
              isDefault: existingAddrs.length === 0,
            });
          }
        } catch {
          // Non-fatal: address saving failure should not block order
        }
      }

      if (data.paymentMethod === "razorpay") {
        if (!isRazorpayConfigured()) {
          return res.status(503).json({ message: "Online payment is temporarily unavailable" });
        }
        const amountPaise = Math.round(data.total * 100);
        const rzpOrder = await createRazorpayOrder(amountPaise, String(order.id));
        await storage.setOrderRazorpayOrderId(order.id, rzpOrder.id);
        return res.json({
          order,
          razorpay: {
            orderId: rzpOrder.id,
            amount: amountPaise,
            currency: "INR",
            keyId: getRazorpayKeyId(),
          },
        });
      }

      res.json({ order });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/orders/:id/verify-payment", async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const body = z.object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      }).parse(req.body);

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.paymentMethod !== "razorpay") {
        return res.status(400).json({ message: "Order is not a Razorpay order" });
      }
      if (order.razorpayOrderId !== body.razorpay_order_id) {
        return res.status(400).json({ message: "Order ID mismatch" });
      }

      const valid = verifyPaymentSignature(
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature
      );
      if (!valid) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const updated = await storage.updateOrderPayment(
        orderId,
        body.razorpay_payment_id,
        "confirmed"
      );
      res.json({ order: updated });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Verification failed" });
    }
  });

  app.get("/api/my-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const email = req.user.email || "";
      const userOrders = await storage.getOrdersByUserIdOrEmail(userId, email);
      res.json(userOrders);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/subscribers", async (req, res) => {
    try {
      const subSchema = z.object({
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        source: z.string().optional().default("popup"),
      });
      const data = subSchema.parse(req.body);
      if (!data.email && !data.phone) {
        return res.status(400).json({ message: "Email or phone required" });
      }
      const sub = await storage.createSubscriber(data as any);
      res.json(sub);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/admin/orders", isAuthenticated, requireAdmin, async (_req, res) => {
    const allOrders = await storage.getOrders();
    res.json(allOrders);
  });

  app.patch("/api/orders/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const statusSchema = z.object({
        status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
      });
      const { status } = statusSchema.parse(req.body);
      const updated = await storage.updateOrderStatus(Number(req.params.id), status);
      if (!updated) return res.status(404).json({ message: "Order not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/products", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { sizes, ...productData } = req.body;
      const sizeSchema = z.array(z.object({
        size: z.string(),
        price: z.number().min(0),
        originalPrice: z.number().nullable().optional(),
        stock: z.number().min(0),
      })).min(1);
      const validatedSizes = sizeSchema.parse(sizes);
      const product = await storage.createProduct(productData, validatedSizes.map(s => ({ ...s, productId: 0 })));
      res.json(product);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/admin/products/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { sizes, ...productData } = req.body;
      const sizeSchema = z.array(z.object({
        id: z.number().optional(),
        size: z.string(),
        price: z.number().min(0),
        originalPrice: z.number().nullable().optional(),
        stock: z.number().min(0),
      })).min(1);
      const validatedSizes = sizeSchema.parse(sizes);
      const product = await storage.updateProduct(Number(req.params.id), productData, validatedSizes.map(s => ({ ...s, originalPrice: s.originalPrice ?? null })));
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/products/:id", isAuthenticated, requireAdmin, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.json({ success: true });
  });

  // CSV template download
  app.get("/api/admin/products/csv-template", isAuthenticated, requireAdmin, (_req, res) => {
    const headers = [
      "name", "brand", "description", "category", "notes",
      "image", "gender", "productType",
      "isBestseller", "isTrending", "isNewArrival",
      "sizes",
    ];
    const example = [
      "Rose Noir", "ISHQARA", "A dark floral scent with rose and oud",
      "Floral", "Rose,Oud,Musk", "/images/perfume-1.png",
      "women", "og", "false", "false", "false",
      "30ml:799:999:50|50ml:1299:1599:30",
    ];
    const csv = [headers.join(","), example.map((v) => `"${v}"`).join(",")].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=ishqara-products-template.csv");
    res.send(csv);
  });

  // CSV bulk import
  app.post("/api/admin/products/import-csv", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { rows } = z.object({
        rows: z.array(z.object({
          name: z.string().min(1),
          brand: z.string().default("ISHQARA"),
          description: z.string().default(""),
          category: z.string().default("Floral"),
          notes: z.string().default(""),
          image: z.string().default("/images/perfume-1.png"),
          gender: z.string().default("unisex"),
          productType: z.string().default("og"),
          isBestseller: z.string().optional(),
          isTrending: z.string().optional(),
          isNewArrival: z.string().optional(),
          sizes: z.string().min(1),
        })).min(1),
      }).parse(req.body);

      const results: { name: string; success: boolean; error?: string }[] = [];

      for (const row of rows) {
        try {
          const notesArr = row.notes.split(",").map((n) => n.trim()).filter(Boolean);
          const parsedSizes = row.sizes.split("|").map((seg) => {
            const [size, price, originalPrice, stock] = seg.trim().split(":");
            return {
              size: size?.trim() || "",
              price: Number(price) || 0,
              originalPrice: Number(originalPrice) > 0 ? Number(originalPrice) : null,
              stock: Number(stock) || 0,
              productId: 0,
            };
          }).filter((s) => s.size);

          if (!parsedSizes.length) throw new Error("No valid sizes parsed");

          await storage.createProduct({
            name: row.name.trim(),
            brand: row.brand || "ISHQARA",
            description: row.description,
            category: row.category,
            notes: notesArr,
            image: row.image,
            gender: row.gender,
            productType: row.productType,
            isBestseller: row.isBestseller === "true",
            isTrending: row.isTrending === "true",
            isNewArrival: row.isNewArrival === "true",
          }, parsedSizes);

          results.push({ name: row.name, success: true });
        } catch (e: any) {
          results.push({ name: row.name || "Unknown", success: false, error: e.message });
        }
      }

      const imported = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      res.json({ imported, failed, results });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/promotions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const promoSchema = z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        discountType: z.enum(["percentage", "flat", "bundle"]),
        discountValue: z.number().min(0),
        code: z.string().nullable().optional(),
        isActive: z.boolean().optional().default(true),
        startDate: z.any().nullable().optional(),
        endDate: z.any().nullable().optional(),
      });
      const data = promoSchema.parse(req.body);
      const promo = await storage.createPromotion(data as any);
      res.json(promo);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/promotions/:id", isAuthenticated, requireAdmin, async (req, res) => {
    const updated = await storage.updatePromotion(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Promotion not found" });
    res.json(updated);
  });

  app.get("/api/admin/subscribers", isAuthenticated, requireAdmin, async (_req, res) => {
    const subs = await storage.getSubscribers();
    res.json(subs);
  });

  // ---- Address management ----
  const addressSchema = z.object({
    label: z.string().min(1).default("Home"),
    recipientName: z.string().min(1),
    phone: z.string().min(10),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional().nullable(),
    city: z.string().min(1),
    state: z.string().default(""),
    pincode: z.string().min(6),
    country: z.string().default("India"),
    isDefault: z.boolean().optional().default(false),
  });

  app.get("/api/addresses", isAuthenticated, async (req: any, res) => {
    const addrs = await storage.getAddressesByUserId(req.user.id);
    res.json(addrs);
  });

  app.post("/api/addresses", isAuthenticated, async (req: any, res) => {
    try {
      const data = addressSchema.parse(req.body);
      const addr = await storage.createAddress({ ...data, userId: req.user.id, addressLine2: data.addressLine2 ?? null });
      res.json(addr);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/addresses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const data = addressSchema.partial().parse(req.body);
      const updated = await storage.updateAddress(Number(req.params.id), req.user.id, data);
      if (!updated) return res.status(404).json({ message: "Address not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/addresses/:id", isAuthenticated, async (req: any, res) => {
    const result = await storage.deleteAddress(Number(req.params.id), req.user.id);
    if (!result.deleted) return res.status(400).json({ message: result.reason });
    res.json({ success: true });
  });

  app.patch("/api/addresses/:id/default", isAuthenticated, async (req: any, res) => {
    await storage.setDefaultAddress(Number(req.params.id), req.user.id);
    res.json({ success: true });
  });

  // ── SEO ─────────────────────────────────────────────────────────────────────
  // Dynamic sitemap — includes all product pages
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      const BASE = "https://ishqara.com";
      const staticRoutes = [
        { loc: "/",               changefreq: "weekly",  priority: "1.0" },
        { loc: "/shop",           changefreq: "daily",   priority: "0.9" },
        { loc: "/deals",          changefreq: "daily",   priority: "0.8" },
        { loc: "/bundles",        changefreq: "weekly",  priority: "0.7" },
        { loc: "/contact",        changefreq: "monthly", priority: "0.5" },
        { loc: "/privacy-policy", changefreq: "yearly",  priority: "0.3" },
        { loc: "/terms",          changefreq: "yearly",  priority: "0.3" },
        { loc: "/refund-policy",  changefreq: "yearly",  priority: "0.3" },
        { loc: "/shipping-policy",changefreq: "yearly",  priority: "0.3" },
      ];

      const now = new Date().toISOString().split("T")[0];

      const urlTags = [
        ...staticRoutes.map(({ loc, changefreq, priority }) => `
  <url>
    <loc>${BASE}${loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`),
        ...products.map((p) => `
  <url>
    <loc>${BASE}/product/${p.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`),
      ].join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}
</urlset>`;

      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (e: any) {
      res.status(500).send("Failed to generate sitemap");
    }
  });

  // ── Settings ────────────────────────────────────────────────────────────────
  // Public read: frontend needs shipping fee, store name, UPI config, etc.
  app.get("/api/settings", async (_req, res) => {
    try {
      const rows = await storage.getSettings();
      // Return as { key: value } map for easy consumption
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      res.json(map);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Full settings list with metadata — admin only
  app.get("/api/admin/settings", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const rows = await storage.getSettings();
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Bulk update settings — admin only
  app.patch("/api/admin/settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const body = z.record(z.string(), z.string()).parse(req.body);
      await storage.upsertSettings(
        Object.entries(body).map(([key, value]) => ({ key, value }))
      );
      const rows = await storage.getSettings();
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      res.json(map);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  return httpServer;
}
