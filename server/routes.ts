import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";

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

  app.post("/api/orders", async (req, res) => {
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
        paymentMethod: z.enum(["cod", "razorpay"]),
      });
      const data = orderSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.claims?.sub || null;
      const order = await storage.createOrder({ ...data, userId });
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/my-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userOrders = await storage.getOrdersByUserId(userId);
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

  app.get("/api/admin/orders", async (_req, res) => {
    const allOrders = await storage.getOrders();
    res.json(allOrders);
  });

  app.patch("/api/orders/:id", async (req, res) => {
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

  app.post("/api/admin/products", async (req, res) => {
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

  app.put("/api/admin/products/:id", async (req, res) => {
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

  app.delete("/api/admin/products/:id", async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/promotions", async (req, res) => {
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

  app.patch("/api/admin/promotions/:id", async (req, res) => {
    const updated = await storage.updatePromotion(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Promotion not found" });
    res.json(updated);
  });

  app.get("/api/admin/subscribers", async (_req, res) => {
    const subs = await storage.getSubscribers();
    res.json(subs);
  });

  return httpServer;
}
