import {
  type Product, type InsertProduct,
  type ProductSize, type InsertProductSize,
  type Review, type InsertReview,
  type Order, type InsertOrder,
  type Promotion, type InsertPromotion,
  type Subscriber, type InsertSubscriber,
  type ProductWithSizes,
  products, productSizes, reviews, orders, promotions, subscribers,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getProducts(): Promise<ProductWithSizes[]>;
  getProduct(id: number): Promise<ProductWithSizes | undefined>;
  createProduct(product: InsertProduct, sizes: InsertProductSize[]): Promise<ProductWithSizes>;
  updateProduct(id: number, product: Partial<InsertProduct>, sizes: { id?: number; size: string; price: number; originalPrice: number | null; stock: number }[]): Promise<ProductWithSizes | undefined>;
  deleteProduct(id: number): Promise<void>;

  getReviewsByProduct(productId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;

  getOrder(id: number): Promise<Order | undefined>;
  getOrders(): Promise<Order[]>;
  getOrdersByUserId(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  updateOrderPayment(id: number, razorpayPaymentId: string, status: string): Promise<Order | undefined>;
  setOrderRazorpayOrderId(id: number, razorpayOrderId: string): Promise<Order | undefined>;

  getPromotions(): Promise<Promotion[]>;
  createPromotion(promo: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: number, data: Partial<InsertPromotion>): Promise<Promotion | undefined>;

  getSubscribers(): Promise<Subscriber[]>;
  createSubscriber(sub: InsertSubscriber): Promise<Subscriber>;
}

export class DatabaseStorage implements IStorage {
  async getProducts(): Promise<ProductWithSizes[]> {
    const allProducts = await db.select().from(products);
    const allSizes = await db.select().from(productSizes);
    return allProducts.map((p) => ({
      ...p,
      sizes: allSizes.filter((s) => s.productId === p.id),
    }));
  }

  async getProduct(id: number): Promise<ProductWithSizes | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) return undefined;
    const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, id));
    return { ...product, sizes };
  }

  async createProduct(product: InsertProduct, sizes: InsertProductSize[]): Promise<ProductWithSizes> {
    const [created] = await db.insert(products).values(product).returning();
    const createdSizes: ProductSize[] = [];
    for (const size of sizes) {
      const [s] = await db.insert(productSizes).values({ ...size, productId: created.id }).returning();
      createdSizes.push(s);
    }
    return { ...created, sizes: createdSizes };
  }

  async updateProduct(id: number, product: Partial<InsertProduct>, sizes: { id?: number; size: string; price: number; originalPrice: number | null; stock: number }[]): Promise<ProductWithSizes | undefined> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    if (!updated) return undefined;

    await db.delete(productSizes).where(eq(productSizes.productId, id));
    const createdSizes: ProductSize[] = [];
    for (const size of sizes) {
      const [s] = await db.insert(productSizes).values({
        productId: id,
        size: size.size,
        price: size.price,
        originalPrice: size.originalPrice,
        stock: size.stock,
      }).returning();
      createdSizes.push(s);
    }
    return { ...updated, sizes: createdSizes };
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(productSizes).where(eq(productSizes.productId, id));
    await db.delete(reviews).where(eq(reviews.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }

  async getReviewsByProduct(productId: number): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    const allReviews = await db.select().from(reviews).where(eq(reviews.productId, review.productId));
    const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    await db.update(products).set({
      avgRating: avg.toFixed(1),
      reviewCount: allReviews.length,
    }).where(eq(products.id, review.productId));
    return created;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return updated;
  }

  async updateOrderPayment(id: number, razorpayPaymentId: string, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({ razorpayPaymentId, status }).where(eq(orders.id, id)).returning();
    return updated;
  }

  async setOrderRazorpayOrderId(id: number, razorpayOrderId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({ razorpayOrderId }).where(eq(orders.id, id)).returning();
    return updated;
  }

  async getPromotions(): Promise<Promotion[]> {
    return db.select().from(promotions);
  }

  async createPromotion(promo: InsertPromotion): Promise<Promotion> {
    const [created] = await db.insert(promotions).values(promo).returning();
    return created;
  }

  async updatePromotion(id: number, data: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updated] = await db.update(promotions).set(data).where(eq(promotions.id, id)).returning();
    return updated;
  }

  async getSubscribers(): Promise<Subscriber[]> {
    return db.select().from(subscribers).orderBy(desc(subscribers.createdAt));
  }

  async createSubscriber(sub: InsertSubscriber): Promise<Subscriber> {
    const [created] = await db.insert(subscribers).values(sub).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
