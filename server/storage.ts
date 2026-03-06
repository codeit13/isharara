import {
  type Product, type InsertProduct,
  type ProductSize, type InsertProductSize,
  type Review, type InsertReview,
  type Order, type InsertOrder,
  type Promotion, type InsertPromotion,
  type Subscriber, type InsertSubscriber,
  type Address, type InsertAddress,
  type Setting,
  type ProductWithSizes,
  products, productSizes, reviews, orders, promotions, subscribers, addresses, settings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, isNull } from "drizzle-orm";

export interface ShopFilters {
  categories: string[];
  genders: string[];
  productTypes: string[];
}

export interface IStorage {
  getProducts(): Promise<ProductWithSizes[]>;
  getAllProducts(): Promise<ProductWithSizes[]>;
  getProduct(id: number): Promise<ProductWithSizes | undefined>;
  getShopFilters(): Promise<ShopFilters>;
  createProduct(product: InsertProduct, sizes: InsertProductSize[]): Promise<ProductWithSizes>;
  updateProduct(id: number, product: Partial<InsertProduct>, sizes: { id?: number; size: string; price: number; originalPrice: number | null; stock: number }[]): Promise<ProductWithSizes | undefined>;
  updateProductFields(id: number, fields: { enabled?: boolean }): Promise<ProductWithSizes | undefined>;
  deleteProduct(id: number): Promise<void>;

  getReviewsByProduct(productId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;

  getOrder(id: number): Promise<Order | undefined>;
  getOrders(): Promise<Order[]>;
  getOrdersByUserId(userId: string): Promise<Order[]>;
  getOrdersByUserIdOrEmail(userId: string, email: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  updateOrderPayment(id: number, razorpayPaymentId: string, status: string): Promise<Order | undefined>;
  setOrderRazorpayOrderId(id: number, razorpayOrderId: string): Promise<Order | undefined>;

  getPromotions(): Promise<Promotion[]>;
  createPromotion(promo: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: number, data: Partial<InsertPromotion>): Promise<Promotion | undefined>;

  getSubscribers(): Promise<Subscriber[]>;
  createSubscriber(sub: InsertSubscriber): Promise<Subscriber>;

  getAddressesByUserId(userId: string): Promise<Address[]>;
  getAddress(id: number, userId: string): Promise<Address | undefined>;
  createAddress(data: InsertAddress): Promise<Address>;
  updateAddress(id: number, userId: string, data: Partial<InsertAddress>): Promise<Address | undefined>;
  deleteAddress(id: number, userId: string): Promise<{ deleted: boolean; reason?: string }>;
  setDefaultAddress(id: number, userId: string): Promise<void>;

  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<string | undefined>;
  upsertSetting(key: string, value: string): Promise<Setting>;
  upsertSettings(entries: { key: string; value: string }[]): Promise<void>;
  seedDefaultSettings(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getProducts(): Promise<ProductWithSizes[]> {
    const allProducts = await db.select().from(products).where(eq(products.enabled, true));
    const allSizes = await db.select().from(productSizes);
    return allProducts.map((p) => ({
      ...p,
      sizes: allSizes.filter((s) => s.productId === p.id),
    }));
  }

  async getAllProducts(): Promise<ProductWithSizes[]> {
    const allProducts = await db.select().from(products);
    const allSizes = await db.select().from(productSizes);
    return allProducts.map((p) => ({
      ...p,
      sizes: allSizes.filter((s) => s.productId === p.id),
    }));
  }

  async getProduct(id: number): Promise<ProductWithSizes | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.enabled, true)));
    if (!product) return undefined;
    const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, id));
    return { ...product, sizes };
  }

  async getShopFilters(): Promise<ShopFilters> {
    const allProducts = await db.select({ category: products.category, gender: products.gender, productType: products.productType }).from(products).where(eq(products.enabled, true));
    const categorySet = new Set<string>();
    const genderSet = new Set<string>();
    const productTypeSet = new Set<string>();
    for (const p of allProducts) {
      (p.category || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => categorySet.add(c));
      if (p.gender) genderSet.add(p.gender);
      if (p.productType) productTypeSet.add(p.productType);
    }
    return {
      categories: Array.from(categorySet).sort(),
      genders: Array.from(genderSet).sort(),
      productTypes: Array.from(productTypeSet).sort(),
    };
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

  async updateProductFields(id: number, fields: { enabled?: boolean }): Promise<ProductWithSizes | undefined> {
    const [updated] = await db.update(products).set(fields).where(eq(products.id, id)).returning();
    if (!updated) return undefined;
    const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, id));
    return { ...updated, sizes };
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

  /** Orders for this user by userId, or by email when userId is null (guest/legacy orders). */
  async getOrdersByUserIdOrEmail(userId: string, email: string): Promise<Order[]> {
    const byUser = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
    const byEmail = email
      ? await db
          .select()
          .from(orders)
          .where(and(isNull(orders.userId), sql`lower(${orders.email}) = lower(${email})`))
          .orderBy(desc(orders.createdAt))
      : [];
    const seen = new Set(byUser.map((o) => o.id));
    const combined = [...byUser];
    for (const o of byEmail) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        combined.push(o);
      }
    }
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
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

  async getAddressesByUserId(userId: string): Promise<Address[]> {
    return db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  }

  async getAddress(id: number, userId: string): Promise<Address | undefined> {
    const [addr] = await db.select().from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
    return addr;
  }

  async createAddress(data: InsertAddress): Promise<Address> {
    const existing = await this.getAddressesByUserId(data.userId);
    // First address is always default
    const isDefault = existing.length === 0 ? true : !!data.isDefault;
    if (isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, data.userId));
    }
    const [created] = await db.insert(addresses).values({ ...data, isDefault }).returning();
    return created;
  }

  async updateAddress(id: number, userId: string, data: Partial<InsertAddress>): Promise<Address | undefined> {
    if (data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }
    const [updated] = await db.update(addresses).set(data).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).returning();
    return updated;
  }

  async deleteAddress(id: number, userId: string): Promise<{ deleted: boolean; reason?: string }> {
    const all = await this.getAddressesByUserId(userId);
    if (all.length <= 1) return { deleted: false, reason: "Cannot delete the only address" };
    const target = all.find((a) => a.id === id);
    if (!target) return { deleted: false, reason: "Address not found" };
    await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
    // If we deleted the default, promote the next one
    if (target.isDefault) {
      const remaining = all.filter((a) => a.id !== id);
      if (remaining.length > 0) {
        await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, remaining[0].id));
      }
    }
    return { deleted: true };
  }

  async setDefaultAddress(id: number, userId: string): Promise<void> {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    await db.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
  }

  async getSettings(): Promise<Setting[]> {
    return db.select().from(settings).orderBy(settings.key);
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    return row?.value;
  }

  async upsertSetting(key: string, value: string): Promise<Setting> {
    const [row] = await db
      .insert(settings)
      .values({ key, value, label: key, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
      .returning();
    return row;
  }

  async upsertSettings(entries: { key: string; value: string }[]): Promise<void> {
    for (const { key, value } of entries) {
      await db
        .insert(settings)
        .values({ key, value, label: key, updatedAt: new Date() })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    }
  }

  async seedDefaultSettings(): Promise<void> {
    const defaults: Omit<Setting, "updatedAt">[] = [
      { key: "shipping_fee",            value: "99",                        label: "Shipping Fee (₹)",              description: "Flat shipping fee charged per order",          type: "number" },
      { key: "free_shipping_threshold", value: "1499",                      label: "Free Shipping Threshold (₹)",   description: "Order subtotal above which shipping is free",   type: "number" },
      { key: "store_name",              value: "ISHQARA",                   label: "Store Name",                    description: "Displayed across the site and in UPI payments", type: "string" },
      { key: "store_email",             value: "ishqaraperfumes@gmail.com", label: "Support Email",                 description: "Contact / support email",                       type: "string" },
      { key: "store_phone",             value: "+91 98679 02305",           label: "Support Phone",                 description: "WhatsApp / support phone number",               type: "string" },
      { key: "upi_business_name",       value: "ISHQARA",                   label: "UPI Business Name",             description: "Name shown in UPI payment screens",             type: "string" },
      { key: "upi_merchant_mode",       value: "false",                     label: "UPI ID Type",                 description: "Personal UPI ID, Merchant UPI ID", type: "boolean" },
      { key: "upi_id",                  value: "",                          label: "UPI ID",                        description: "Business UPI VPA e.g. ishqara@upi",             type: "string" },
      { key: "upi_merchant_code",       value: "5999",                      label: "UPI Merchant Code (MCC)",       description: "4-digit MCC for merchant mode only (Only enter if UPI is a merchant VPA)", type: "string" },
      { key: "cod_enabled",             value: "false",                     label: "Cash on Delivery",              description: "Enable or disable Cash on Delivery option",     type: "boolean" },
      { key: "min_order_amount",        value: "0",                         label: "Minimum Order Amount (₹)",      description: "Minimum cart value required to place an order",  type: "number" },
      { key: "razorpay_enabled",        value: "true",                      label: "Pay via Razorpay",              description: "Show Card / Net Banking (Razorpay) option at checkout", type: "boolean" },
      { key: "badge_delivery_enabled",   value: "true",                      label: "Show Free Delivery Badge",      description: "Show delivery badge on product page", type: "boolean" },
      { key: "badge_delivery_text",     value: "Free Delivery ₹{amount}+",   label: "Delivery Badge Text",           description: "Use {amount} for free shipping threshold", type: "string" },
      { key: "badge_returns_enabled",   value: "true",                      label: "Show Returns Badge",            description: "Show returns badge on product page", type: "boolean" },
      { key: "badge_returns_text",       value: "7-Day Returns",             label: "Returns Badge Text",            description: "Custom text for returns badge", type: "string" },
      { key: "badge_authentic_enabled",  value: "true",                      label: "Show Authentic Badge",          description: "Show authenticity badge on product page", type: "boolean" },
      { key: "badge_authentic_text",    value: "100% Authentic",            label: "Authentic Badge Text",           description: "Custom text for authenticity badge", type: "string" },
    ];
    for (const d of defaults) {
      await db
        .insert(settings)
        .values({ ...d, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { label: d.label, description: d.description ?? null, type: d.type, updatedAt: new Date() },
        });
    }
  }
}

export const storage = new DatabaseStorage();
