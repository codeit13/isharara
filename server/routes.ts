import type { Express } from "express";
import multer from "multer";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { isAuthenticated, requireAdmin, requireSuperAdmin, optionalAuth } from "./auth";
import { authStorage, normalizePhone } from "./auth/storage";
import { invalidateTenantCache } from "./tenant";
import { tenants, tenantMembers, tenantPayments, products, orders, users } from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, lte, desc } from "drizzle-orm";
import {
  isRazorpayConfigured,
  getRazorpayKeyId,
  createRazorpayOrder,
  verifyPaymentSignature,
} from "./razorpay";
import {
  uploadSingleImage,
  uploadImageByFilename,
  uploadLogo,
  getImageBuffer,
  isAllowedImage,
  sanitizeProductName,
} from "./uploads";
import dns from "dns/promises";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const normalizeAdminText = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const normalizeCategoryValue = (value: unknown, categories: unknown) => {
  const values = [
    ...(Array.isArray(categories) ? categories : []),
    ...normalizeAdminText(value).split(","),
  ]
    .map((item) => normalizeAdminText(item))
    .filter(Boolean);

  return Array.from(new Set(values)).join(", ");
};

const adminProductPayloadSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  categories: z.array(z.string()).optional(),
  notes: z.union([z.array(z.string()), z.string()]).optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  gender: z.string().optional(),
  productType: z.string().optional(),
  enabled: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
});

function parseAdminProductPayload(input: unknown) {
  const parsed = adminProductPayloadSchema.parse(input);

  const image = normalizeAdminText(parsed.image) || "/images/perfume-1.png";
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes
    : typeof parsed.notes === "string"
      ? parsed.notes.split(",")
      : [];

  return {
    name: normalizeAdminText(parsed.name),
    brand: normalizeAdminText(parsed.brand) || "ISHQARA",
    description: normalizeAdminText(parsed.description),
    category: normalizeCategoryValue(parsed.category, parsed.categories) || "Uncategorized",
    notes: Array.from(new Set(notes.map((note) => normalizeAdminText(note)).filter(Boolean))),
    image,
    images: parsed.images?.map((img) => normalizeAdminText(img)).filter(Boolean) || [image],
    gender: normalizeAdminText(parsed.gender) || "unisex",
    productType: normalizeAdminText(parsed.productType) || "og",
    enabled: parsed.enabled ?? true,
    isBestseller: parsed.isBestseller ?? false,
    isTrending: parsed.isTrending ?? false,
    isNewArrival: parsed.isNewArrival ?? false,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Serve product images from Replit Object Storage (public, no auth)
  app.get("/api/uploads/{*path}", async (req, res) => {
    const objectName = (req.params as { path?: string }).path ?? "";
    if (!objectName?.includes("products/") && !objectName?.includes("logo")) {
      return res.status(400).json({ message: "Invalid path" });
    }
    const buffer = await getImageBuffer(objectName);
    if (!buffer) return res.status(404).json({ message: "Image not found" });
    const ext = objectName.split(".").pop()?.toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type(mime).send(buffer);
  });

  app.get("/api/products", async (req, res) => {
    const tid = req.tenant.id;
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    const page = pageParam ? parseInt(pageParam, 10) : 0;
    const limit = limitParam ? parseInt(limitParam, 10) : 0;

    if (page >= 1 && limit >= 1) {
      const result = await storage.getProductsPaginated(tid, {
        page,
        limit,
        category: (req.query.category as string) || undefined,
        gender: (req.query.gender as string) || undefined,
        productType: (req.query.productType as string) || undefined,
        tag: (req.query.tag as string) || undefined,
        sort: (req.query.sort as string) || undefined,
      });
      res.json(result);
    } else {
      const products = await storage.getProducts(tid);
      res.json(products);
    }
  });

  app.get("/api/products/search", async (req, res) => {
    const q = (req.query.q as string) ?? "";
    const trimmed = q.trim();
    if (!trimmed) {
      return res.json([]);
    }
    try {
      const products = await storage.searchProducts(req.tenant.id, trimmed);
      res.json(products);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Search failed" });
    }
  });

  app.get("/api/admin/products", isAuthenticated, requireAdmin, async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "10", 10));
    const search = ((req.query.search as string) || "").trim();
    const products = await storage.getAdminProductsPaginated(req.tenant.id, { page, limit, search });
    res.json(products);
  });

  app.get("/api/admin/dashboard-summary", isAuthenticated, requireAdmin, async (req, res) => {
    const summary = await storage.getAdminDashboardSummary(req.tenant.id);
    res.json(summary);
  });

  app.get("/api/shop-filters", async (req, res) => {
    const filters = await storage.getShopFilters(req.tenant.id);
    res.json(filters);
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

  app.get("/api/promotions", async (req, res) => {
    const promos = await storage.getPromotions(req.tenant.id);
    res.json(promos);
  });

  app.post("/api/checkout/validate-promo", optionalAuth, async (req, res) => {
    try {
      const tid = req.tenant.id;
      const body = z.object({
        code: z.string().min(1),
        email: z.string().email().optional(),
      }).parse(req.body);
      const user = (req as any).user;
      const userId = user?.id ?? null;
      const email = body.email || user?.email || "";

      const promos = await storage.getPromotions(tid);
      const promo = promos.find((p) => p.isActive && p.code?.toUpperCase() === body.code.trim().toUpperCase());
      if (!promo) {
        return res.json({ valid: false, reason: "Invalid or expired code" });
      }

      const now = new Date();
      if (promo.startDate && new Date(promo.startDate) > now) {
        return res.json({ valid: false, reason: "This code is not yet active" });
      }
      if (promo.endDate && new Date(promo.endDate) < now) {
        return res.json({ valid: false, reason: "This code has expired" });
      }

      if (promo.firstOrderOnly) {
        if (!email) {
          return res.json({ valid: false, reason: "Enter your email to use this first-order code" });
        }
        const hasOrdered = await storage.hasOrderedBefore(tid, userId, email);
        if (hasOrdered) {
          return res.json({ valid: false, reason: "This code is for first-time customers only" });
        }
      }

      res.json({ valid: true, promo });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/orders", optionalAuth, async (req, res) => {
    try {
      const tid = req.tenant.id;
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
          image: z.string().optional(), // product image URL per line item (for admin order details)
          size: z.string(),
          price: z.number(),
          quantity: z.number().min(1),
        })).min(1),
        subtotal: z.number().min(0),
        discount: z.number().min(0),
        total: z.number().min(0),
        paymentMethod: z.enum(["upi", "razorpay"]),
        promoCode: z.string().optional(),
      });
      const data = orderSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || null;

      if (data.discount > 0 && data.promoCode) {
        const promos = await storage.getPromotions(tid);
        const promo = promos.find((p) => p.isActive && p.code?.toUpperCase() === data.promoCode!.trim().toUpperCase());
        if (promo?.firstOrderOnly) {
          const hasOrdered = await storage.hasOrderedBefore(tid, userId, data.email);
          if (hasOrdered) {
            return res.status(400).json({ message: "This code is for first-time customers only" });
          }
        }
      }

      const { promoCode: _pc, ...orderData } = data;
      const order = await storage.createOrder(tid, { ...orderData, userId });

      if (user) {
        const normalizedPhone = normalizePhone(data.phone);
        if (!user.phone && normalizedPhone.length >= 10) {
          await authStorage.linkPhone(user.id, normalizedPhone).catch(() => {});
        }
        if (!user.email && data.email) {
          await authStorage.linkEmail(user.id, data.email).catch(() => {});
        }

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
        const razorpayEnabled = (await storage.getSetting(tid, "razorpay_enabled")) !== "false";
        if (!razorpayEnabled || !isRazorpayConfigured()) {
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
      const tid = req.tenant.id;
      const userId = req.user.id;
      const email = req.user.email || "";
      const userOrders = await storage.getOrdersByUserIdOrEmail(tid, userId, email);
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
      const sub = await storage.createSubscriber(req.tenant.id, data as any);
      res.json(sub);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/admin/orders", isAuthenticated, requireAdmin, async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "10", 10));
    const search = ((req.query.search as string) || "").trim();
    const status = ((req.query.status as string) || "all").trim();
    const allOrders = await storage.getAdminOrdersPaginated(req.tenant.id, { page, limit, search, status });
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
      const validatedProduct = parseAdminProductPayload(productData);
      const sizeSchema = z.array(z.object({
        size: z.string(),
        price: z.number().min(0),
        originalPrice: z.number().nullable().optional(),
        stock: z.number().min(0),
      })).min(1);
      const validatedSizes = sizeSchema.parse(sizes);
      const product = await storage.createProduct(req.tenant.id, validatedProduct, validatedSizes.map(s => ({ ...s, productId: 0 })));
      res.json(product);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/admin/products/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { sizes, ...productData } = req.body;
      const validatedProduct = parseAdminProductPayload(productData);
      const sizeSchema = z.array(z.object({
        id: z.number().optional(),
        size: z.string(),
        price: z.number().min(0),
        originalPrice: z.number().nullable().optional(),
        stock: z.number().min(0),
      })).min(1);
      const validatedSizes = sizeSchema.parse(sizes);
      const product = await storage.updateProduct(Number(req.params.id), validatedProduct, validatedSizes.map(s => ({ ...s, originalPrice: s.originalPrice ?? null })));
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/products/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const body = z.object({ enabled: z.boolean() }).parse(req.body);
      const product = await storage.updateProductFields(Number(req.params.id), { enabled: body.enabled });
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

  // Single image upload (for Add/Edit product modal)
  app.post("/api/admin/upload-image", isAuthenticated, requireAdmin, upload.single("image"), async (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ message: "No image file provided" });
    if (!isAllowedImage(file.mimetype, file.size)) {
      return res.status(400).json({ message: "Invalid file. Use JPEG, PNG or WebP, max 2MB." });
    }
    try {
      const url = await uploadSingleImage(file.buffer, file.mimetype, req.tenant.slug);
      res.json({ url });
    } catch (e: any) {
      const msg = e.message ?? "Upload failed";
      const isStorageError = /URL is required|ECONNREFUSED|fetch failed|Replit/i.test(msg);
      res.status(500).json({
        message: isStorageError
          ? "Replit Object Storage is not available. Deploy from Replit or use /images/ paths."
          : msg,
      });
    }
  });

  // Bulk upload: match filenames to products, upload to Replit, update DB
  app.post("/api/admin/bulk-upload-images", isAuthenticated, requireAdmin, upload.array("images", 50), async (req, res) => {
    const files = (req as any).files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ message: "No image files provided" });
    for (const f of files) {
      if (!isAllowedImage(f.mimetype, f.size)) {
        return res.status(400).json({ message: `Invalid file: ${f.originalname}. Use JPEG, PNG or WebP, max 2MB each.` });
      }
    }
    try {
      const allProducts = await storage.getAllProducts(req.tenant.id);
      const updated: { productId: number; name: string; url: string }[] = [];
      const unmatched: string[] = [];

      for (const file of files) {
        const nameWithoutExt = file.originalname.replace(/\.[^.]+$/, "");
        const sanitized = sanitizeProductName(nameWithoutExt);
        const product = allProducts.find((p) => sanitizeProductName(p.name) === sanitized);
        if (!product) {
          unmatched.push(file.originalname);
          continue;
        }
        const url = await uploadImageByFilename(file.buffer, file.mimetype, file.originalname, req.tenant.slug);
        await storage.updateProduct(product.id, { image: url, images: [url] }, product.sizes.map((s) => ({ ...s, originalPrice: s.originalPrice ?? null })));
        updated.push({ productId: product.id, name: product.name, url });
      }

      res.json({ updated, unmatched });
    } catch (e: any) {
      const msg = e.message ?? "Upload failed";
      const isStorageError = /URL is required|ECONNREFUSED|fetch failed|Replit/i.test(msg);
      res.status(500).json({
        message: isStorageError
          ? "Replit Object Storage is not available in this environment. Deploy from Replit or use /images/ paths for product images."
          : msg,
      });
    }
  });

  // CSV template download
  app.get("/api/admin/products/csv-template", isAuthenticated, requireAdmin, (_req, res) => {
    const headers = [
      "name", "brand", "description", "category", "notes",
      "image", "gender", "productType",
      "enabled", "isBestseller", "isTrending", "isNewArrival",
      "sizes",
    ];
    const example = [
      "Rose Noir", "ISHQARA", "A dark floral scent with rose and oud",
      "Floral", "Rose,Oud,Musk", "/images/perfume-1.png",
      "women", "og", "true", "false", "false", "false",
      "50ml:499:599:30|100ml:799:999:20",
    ];
    const csv = [headers.join(","), example.map((v) => `"${v}"`).join(",")].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=ishqara-products-template.csv");
    res.send(csv);
  });

  // CSV bulk import
  app.post("/api/admin/products/import-csv", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const tid = req.tenant.id;
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
          enabled: z.string().optional(),
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

          await storage.createProduct(tid, {
            name: row.name.trim(),
            brand: row.brand || "ISHQARA",
            description: row.description,
            category: row.category,
            notes: notesArr,
            image: row.image,
            gender: row.gender,
            productType: row.productType,
            enabled: row.enabled !== "false",
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
        firstOrderOnly: z.boolean().optional().default(false),
        startDate: z.any().nullable().optional(),
        endDate: z.any().nullable().optional(),
      });
      const data = promoSchema.parse(req.body);
      const promo = await storage.createPromotion(req.tenant.id, data as any);
      res.json(promo);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/promotions/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const patchSchema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        discountType: z.enum(["percentage", "flat", "bundle"]).optional(),
        discountValue: z.number().min(0).optional(),
        code: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        firstOrderOnly: z.boolean().optional(),
        startDate: z.any().nullable().optional(),
        endDate: z.any().nullable().optional(),
      });
      const data = patchSchema.parse(req.body);
      const updated = await storage.updatePromotion(Number(req.params.id), data);
      if (!updated) return res.status(404).json({ message: "Promotion not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/admin/subscribers", isAuthenticated, requireAdmin, async (req, res) => {
    const subs = await storage.getSubscribers(req.tenant.id);
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
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const tid = req.tenant?.id ?? 1;
      const allProducts = await storage.getProducts(tid);
      const domain = req.tenant?.domain || "ishqara.com";
      const BASE = `https://${domain}`;
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
        ...allProducts.map((p) => `
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
  app.get("/api/settings", async (req, res) => {
    try {
      const rows = await storage.getSettings(req.tenant.id);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      res.json(map);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const rows = await storage.getSettings(req.tenant.id);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const tid = req.tenant.id;
      const body = z.record(z.string(), z.string()).parse(req.body);
      await storage.upsertSettings(
        tid,
        Object.entries(body).map(([key, value]) => ({ key, value }))
      );
      const rows = await storage.getSettings(tid);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      res.json(map);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Tenant info (public) ───────────────────────────────────────────────────
  app.get("/api/tenant", async (req, res) => {
    const t = req.tenant;
    res.json({
      id: t.id,
      name: t.name,
      slug: t.slug,
      logo: t.logo,
      brandColor: t.brandColor,
      supportEmail: t.supportEmail,
      supportPhone: t.supportPhone,
      domain: t.domain,
      domainVerified: t.domainVerified,
    });
  });

  // ── Super Admin routes ────────────────────────────────────────────────────

  app.get("/api/super-admin/stats", isAuthenticated, requireSuperAdmin, async (_req, res) => {
    try {
      const [tenantCount] = await db.select({ count: sql<number>`count(*)::int` }).from(tenants);
      const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      const [orderCount] = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
      const [productCount] = await db.select({ count: sql<number>`count(*)::int` }).from(products);

      // Platform billing revenue (paid payments from tenants)
      const [collected] = await db
        .select({ total: sql<number>`coalesce(sum(${tenantPayments.amount}), 0)::int` })
        .from(tenantPayments)
        .where(eq(tenantPayments.status, "paid"));
      const [pending] = await db
        .select({ total: sql<number>`coalesce(sum(${tenantPayments.amount}), 0)::int` })
        .from(tenantPayments)
        .where(eq(tenantPayments.status, "pending"));
      const [overdue] = await db
        .select({
          total: sql<number>`coalesce(sum(${tenantPayments.amount}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(tenantPayments)
        .where(eq(tenantPayments.status, "overdue"));

      // Mrr: sum retainerAmount of active tenants with monthly billing
      const [mrr] = await db
        .select({ total: sql<number>`coalesce(sum(${tenants.retainerAmount}), 0)::int` })
        .from(tenants)
        .where(and(eq(tenants.isActive, true), eq(tenants.billingCycle, "monthly")));
      // Arr: monthly * 12 + yearly retainers
      const [yearlyRetainers] = await db
        .select({ total: sql<number>`coalesce(sum(${tenants.retainerAmount}), 0)::int` })
        .from(tenants)
        .where(and(eq(tenants.isActive, true), eq(tenants.billingCycle, "yearly")));

      res.json({
        tenants: tenantCount.count,
        users: userCount.count,
        orders: orderCount.count,
        products: productCount.count,
        revenue: collected.total,
        pendingRevenue: pending.total,
        overdueRevenue: overdue.total,
        overdueCount: overdue.count,
        mrr: mrr.total,
        arr: mrr.total * 12 + yearlyRetainers.total,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/super-admin/users/search", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const q = String(req.query.q || "").trim().toLowerCase();
      if (q.length < 2) return res.json([]);
      const results = await db
        .select({
          id: users.id,
          email: users.email,
          phone: users.phone,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          isSuperAdmin: users.isSuperAdmin,
        })
        .from(users)
        .where(
          sql`lower(${users.email}) like ${"%" + q + "%"} OR lower(${users.firstName}) like ${"%" + q + "%"} OR lower(${users.lastName}) like ${"%" + q + "%"} OR ${users.phone} like ${"%" + q + "%"}`
        )
        .limit(10);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/super-admin/tenants", isAuthenticated, requireSuperAdmin, async (_req, res) => {
    try {
      const all = await db.select().from(tenants);
      // Attach member count and order/product counts per tenant
      const enriched = await Promise.all(all.map(async (t) => {
        const [mc] = await db.select({ count: sql<number>`count(*)::int` }).from(tenantMembers).where(eq(tenantMembers.tenantId, t.id));
        const [oc] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.tenantId, t.id));
        const [pc] = await db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.tenantId, t.id));
        const [rv] = await db.select({ total: sql<number>`coalesce(sum(${orders.total}), 0)::int` }).from(orders).where(eq(orders.tenantId, t.id));
        const [billingCollected] = await db.select({ total: sql<number>`coalesce(sum(${tenantPayments.amount}), 0)::int` }).from(tenantPayments).where(and(eq(tenantPayments.tenantId, t.id), eq(tenantPayments.status, "paid")));
        const [billingPending] = await db.select({ total: sql<number>`coalesce(sum(${tenantPayments.amount}), 0)::int` }).from(tenantPayments).where(and(eq(tenantPayments.tenantId, t.id), eq(tenantPayments.status, "pending")));
        const [billingOverdue] = await db.select({ total: sql<number>`coalesce(sum(${tenantPayments.amount}), 0)::int` }).from(tenantPayments).where(and(eq(tenantPayments.tenantId, t.id), eq(tenantPayments.status, "overdue")));
        return {
          ...t,
          memberCount: mc.count, orderCount: oc.count, productCount: pc.count,
          orderRevenue: rv.total,
          billingCollected: billingCollected.total,
          billingPending: billingPending.total,
          billingOverdue: billingOverdue.total,
        };
      }));
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/super-admin/tenants", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const body = z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        domain: z.string().optional().nullable(),
        logo: z.string().optional().nullable(),
        brandColor: z.string().optional().nullable(),
        supportEmail: z.string().email().optional().nullable(),
        supportPhone: z.string().optional().nullable(),
      }).parse(req.body);

      const [created] = await db.insert(tenants).values({
        name: body.name,
        slug: body.slug,
        domain: body.domain ?? null,
        logo: body.logo ?? null,
        brandColor: body.brandColor ?? null,
        supportEmail: body.supportEmail ?? null,
        supportPhone: body.supportPhone ?? null,
      }).returning();

      // Seed default settings for the new tenant
      await storage.seedDefaultSettings(created.id);

      // If an initial admin user ID was provided, add them as owner
      const adminUserId = req.body.adminUserId as string | undefined;
      if (adminUserId) {
        await authStorage.addTenantMember(created.id, adminUserId, "owner");
      }

      invalidateTenantCache();
      res.json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/super-admin/tenants/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = z.object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
        domain: z.string().optional().nullable(),
        logo: z.string().optional().nullable(),
        brandColor: z.string().optional().nullable(),
        supportEmail: z.string().email().optional().nullable(),
        supportPhone: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      }).parse(req.body);

      const [updated] = await db.update(tenants).set(body).where(eq(tenants.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Tenant not found" });

      invalidateTenantCache();
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/super-admin/tenants/:id/members", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const members = await authStorage.getTenantMembers(tenantId);
      res.json(members);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/super-admin/tenants/:id/members", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const body = z.object({
        userId: z.string().min(1),
        role: z.enum(["owner", "admin", "staff"]),
      }).parse(req.body);

      const member = await authStorage.addTenantMember(tenantId, body.userId, body.role);
      res.json(member);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/super-admin/tenants/:id/members/:userId", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const userId = String(req.params.userId);
      await authStorage.removeTenantMember(tenantId, userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Tenant settings (Super Admin) ────────────────────────────────────────
  app.get("/api/super-admin/tenants/:id/settings", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const rows = await storage.getSettings(tenantId);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      res.json(map);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/super-admin/tenants/:id/settings", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const body = z.record(z.string(), z.string()).parse(req.body);
      await storage.upsertSettings(
        tenantId,
        Object.entries(body).map(([key, value]) => ({ key, value }))
      );
      const rows = await storage.getSettings(tenantId);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      res.json(map);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/super-admin/tenants/:id/members/:userId/role", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const userId = String(req.params.userId);
      const body = z.object({ role: z.enum(["owner", "admin", "staff"]) }).parse(req.body);
      const member = await authStorage.addTenantMember(tenantId, userId, body.role);
      res.json(member);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Tenant logo upload ────────────────────────────────────────────────────
  app.post("/api/super-admin/tenants/:id/logo", isAuthenticated, requireSuperAdmin, upload.single("logo"), async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "No image file provided" });
      if (!isAllowedImage(file.mimetype, file.size)) {
        return res.status(400).json({ message: "Invalid file. Use JPEG, PNG or WebP, max 2MB." });
      }

      const url = await uploadLogo(file.buffer, file.mimetype, tenant.slug);
      await db.update(tenants).set({ logo: url }).where(eq(tenants.id, tenantId));
      invalidateTenantCache();
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "Logo upload failed" });
    }
  });

  app.delete("/api/super-admin/tenants/:id/logo", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      await db.update(tenants).set({ logo: null }).where(eq(tenants.id, tenantId));
      invalidateTenantCache();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Domain DNS verification ───────────────────────────────────────────────
  // Apex (e.g. example.com) → use A record. Subdomain (e.g. shop.example.com) → use CNAME.
  const isApexDomain = (d: string) => d.split(".").filter(Boolean).length <= 2;

  app.get("/api/super-admin/tenants/:id/domain-info", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      if (!tenant.domain) return res.status(400).json({ message: "No domain configured" });
      const domain = tenant.domain;
      const serverHost = req.get("host")?.split(":")[0] ?? "localhost";
      const apex = isApexDomain(domain);
      let serverIp: string | null = null;
      try {
        const ips = await dns.resolve4(serverHost);
        serverIp = ips[0] ?? null;
      } catch {}
      res.json({
        serverHost,
        serverIp,
        recordType: apex ? "A" : "CNAME",
        record: apex
          ? { type: "A", host: "@", value: serverIp ?? serverHost, ttl: 3600 }
          : { type: "CNAME", host: domain, value: serverHost, ttl: 3600 },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/super-admin/tenants/:id/verify-domain", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      if (!tenant.domain) return res.status(400).json({ message: "No domain configured" });

      const domain = tenant.domain;
      const serverHost = req.get("host")?.split(":")[0] ?? "localhost";
      const checks: { type: string; status: "pass" | "fail" | "warn"; detail: string }[] = [];
      const apex = isApexDomain(domain);

      // Resolve server IP once (for apex A-record comparison and instructions)
      let serverIps: string[] = [];
      try {
        serverIps = await dns.resolve4(serverHost);
      } catch {}

      if (apex) {
        // Apex domain: require A record pointing to our server IP
        try {
          const aRecords = await dns.resolve4(domain);
          const aMatch = serverIps.length > 0 && aRecords.some((ip) => serverIps.includes(ip));
          checks.push({
            type: "A",
            status: aMatch ? "pass" : aRecords.length > 0 ? "warn" : "fail",
            detail: aRecords.length > 0
              ? `A record(s): ${aRecords.join(", ")}${aMatch ? " ✓" : ` (expected server IP: ${serverIps.join(", ") || "unknown"})`}`
              : `No A record found for ${domain}. Add an A record pointing to your server IP.`,
          });
        } catch {
          checks.push({
            type: "A",
            status: "fail",
            detail: `No A record found for ${domain}. Root/apex domains must use an A record (not CNAME).`,
          });
        }
      } else {
        // Subdomain: require CNAME pointing to server hostname
        try {
          const cnames = await dns.resolveCname(domain);
          const cnameMatch = cnames.some(
            (rec) => rec.replace(/\.$/, "").toLowerCase() === serverHost.toLowerCase()
          );
          checks.push({
            type: "CNAME",
            status: cnameMatch ? "pass" : "warn",
            detail: cnameMatch
              ? `CNAME ${domain} → ${cnames[0]} ✓`
              : `CNAME resolves to ${cnames.join(", ")} (expected ${serverHost})`,
          });
        } catch {
          checks.push({
            type: "CNAME",
            status: "fail",
            detail: `No CNAME record found for ${domain}. Add a CNAME record pointing to ${serverHost}.`,
          });
        }
      }

      // 3. HTTP reachability — does the domain actually reach us?
      let httpOk = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const probe = await fetch(`https://${domain}/api/tenant`, {
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeout);
        if (probe.ok) {
          const body = await probe.json() as any;
          httpOk = body?.id === tenantId;
          checks.push({
            type: "HTTPS",
            status: httpOk ? "pass" : "warn",
            detail: httpOk
              ? `https://${domain} is reachable and resolves to this tenant ✓`
              : `https://${domain} responded but tenant ID mismatch (got ${body?.id})`,
          });
        } else {
          checks.push({ type: "HTTPS", status: "warn", detail: `https://${domain} returned HTTP ${probe.status}` });
        }
      } catch (e: any) {
        // Try HTTP fallback
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const probe = await fetch(`http://${domain}/api/tenant`, {
            signal: controller.signal,
            redirect: "follow",
          });
          clearTimeout(timeout);
          if (probe.ok) {
            const body = await probe.json() as any;
            httpOk = body?.id === tenantId;
            checks.push({
              type: "HTTP",
              status: httpOk ? "warn" : "warn",
              detail: httpOk
                ? `http://${domain} is reachable (SSL not yet configured)`
                : `http://${domain} responded but tenant ID mismatch`,
            });
          }
        } catch {
          checks.push({
            type: "HTTPS",
            status: "fail",
            detail: `Cannot reach ${domain} — DNS not propagated or server not accessible`,
          });
        }
      }

      const dnsRecordCheck = checks.find((c) => c.type === "A" || c.type === "CNAME");
      const dnsReady = dnsRecordCheck?.status === "pass";
      const reachable = checks.some((c) => c.status === "pass" && (c.type === "HTTPS" || c.type === "HTTP"));
      const allPass = dnsReady && reachable;

      if (allPass) {
        await db.update(tenants).set({ domainVerified: true, domainVerifiedAt: new Date() }).where(eq(tenants.id, tenantId));
        invalidateTenantCache();
      } else if (!dnsReady && tenant.domainVerified) {
        await db.update(tenants).set({ domainVerified: false, domainVerifiedAt: null }).where(eq(tenants.id, tenantId));
        invalidateTenantCache();
      }

      const serverIp = serverIps[0] ?? null;
      res.json({
        verified: allPass,
        dnsReady,
        checks,
        serverHost,
        recordType: apex ? "A" : "CNAME",
        instructions: {
          recordType: apex ? "A" : "CNAME",
          record: apex
            ? { type: "A", host: "@", value: serverIp ?? serverHost, ttl: 3600 }
            : { type: "CNAME", host: domain, value: serverHost, ttl: 3600 },
          cname: { type: "CNAME", host: domain, value: serverHost, ttl: 3600 },
          ...(allPass ? {} : {
            note: dnsReady
              ? "DNS is pointing correctly but the domain is not yet reachable via HTTPS. Ensure your reverse proxy / CDN is configured."
              : apex
                ? `Add an A record for "${domain}" (or @) pointing to your server IP${serverIp ? ` (${serverIp})` : ""}. DNS propagation can take up to 48 hours.`
                : `Add a CNAME record for "${domain}" pointing to "${serverHost}". DNS propagation can take up to 48 hours.`,
          }),
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Tenant billing config ──────────────────────────────────────────────────
  app.patch("/api/super-admin/tenants/:id/billing", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = z.object({
        setupFee: z.number().int().min(0).optional().nullable(),
        retainerAmount: z.number().int().min(0).optional().nullable(),
        billingCycle: z.enum(["monthly", "yearly", "one-time"]).optional().nullable(),
        billingStartDate: z.string().optional().nullable(),
        nextDueDate: z.string().optional().nullable(),
        currency: z.string().optional(),
      }).parse(req.body);

      const update: Record<string, unknown> = {};
      if (body.setupFee !== undefined) update.setupFee = body.setupFee;
      if (body.retainerAmount !== undefined) update.retainerAmount = body.retainerAmount;
      if (body.billingCycle !== undefined) update.billingCycle = body.billingCycle;
      if (body.billingStartDate !== undefined) update.billingStartDate = body.billingStartDate ? new Date(body.billingStartDate) : null;
      if (body.nextDueDate !== undefined) update.nextDueDate = body.nextDueDate ? new Date(body.nextDueDate) : null;
      if (body.currency) update.currency = body.currency;

      const [updated] = await db.update(tenants).set(update).where(eq(tenants.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Tenant not found" });
      invalidateTenantCache();
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Tenant payments CRUD ──────────────────────────────────────────────────
  app.get("/api/super-admin/tenants/:id/payments", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const payments = await db
        .select()
        .from(tenantPayments)
        .where(eq(tenantPayments.tenantId, tenantId))
        .orderBy(desc(tenantPayments.createdAt));
      res.json(payments);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/super-admin/tenants/:id/payments", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = Number(req.params.id);
      const body = z.object({
        type: z.enum(["setup", "retainer", "addon", "refund", "custom"]),
        amount: z.number().int(),
        status: z.enum(["paid", "pending", "overdue", "waived"]).default("pending"),
        dueDate: z.string().optional().nullable(),
        paidAt: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
        currency: z.string().default("INR"),
      }).parse(req.body);

      const [payment] = await db.insert(tenantPayments).values({
        tenantId,
        type: body.type,
        amount: body.amount,
        currency: body.currency,
        status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        paidAt: body.paidAt ? new Date(body.paidAt) : body.status === "paid" ? new Date() : null,
        note: body.note ?? null,
      }).returning();

      // Auto-advance nextDueDate if retainer paid
      if (body.type === "retainer" && body.status === "paid") {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
        if (tenant?.billingCycle && tenant.nextDueDate) {
          const next = new Date(tenant.nextDueDate);
          if (tenant.billingCycle === "monthly") next.setMonth(next.getMonth() + 1);
          else if (tenant.billingCycle === "yearly") next.setFullYear(next.getFullYear() + 1);
          await db.update(tenants).set({ nextDueDate: next }).where(eq(tenants.id, tenantId));
        }
      }

      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/super-admin/payments/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = z.object({
        status: z.enum(["paid", "pending", "overdue", "waived"]).optional(),
        paidAt: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
        amount: z.number().int().optional(),
      }).parse(req.body);

      const update: Record<string, unknown> = {};
      if (body.status) {
        update.status = body.status;
        if (body.status === "paid" && !body.paidAt) update.paidAt = new Date();
      }
      if (body.paidAt !== undefined) update.paidAt = body.paidAt ? new Date(body.paidAt) : null;
      if (body.note !== undefined) update.note = body.note;
      if (body.amount !== undefined) update.amount = body.amount;

      const [updated] = await db.update(tenantPayments).set(update).where(eq(tenantPayments.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Payment not found" });

      // Auto-advance nextDueDate if retainer just marked paid
      if (body.status === "paid" && updated.type === "retainer") {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, updated.tenantId));
        if (tenant?.billingCycle && tenant.nextDueDate) {
          const next = new Date(tenant.nextDueDate);
          if (tenant.billingCycle === "monthly") next.setMonth(next.getMonth() + 1);
          else if (tenant.billingCycle === "yearly") next.setFullYear(next.getFullYear() + 1);
          await db.update(tenants).set({ nextDueDate: next }).where(eq(tenants.id, updated.tenantId));
        }
      }

      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/super-admin/payments/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [deleted] = await db.delete(tenantPayments).where(eq(tenantPayments.id, id)).returning();
      if (!deleted) return res.status(404).json({ message: "Payment not found" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Mark overdue payments (can be called by cron or manually) ─────────────
  app.post("/api/super-admin/billing/mark-overdue", isAuthenticated, requireSuperAdmin, async (_req, res) => {
    try {
      const now = new Date();
      const result = await db
        .update(tenantPayments)
        .set({ status: "overdue" })
        .where(and(
          eq(tenantPayments.status, "pending"),
          lte(tenantPayments.dueDate, now),
        ))
        .returning();
      res.json({ marked: result.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
