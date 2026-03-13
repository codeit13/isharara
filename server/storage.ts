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
import { eq, desc, asc, sql, and, or, isNull, count } from "drizzle-orm";

export interface ShopFilters {
  categories: string[];
  genders: string[];
  productTypes: string[];
}

/** Escape ILIKE/LIKE pattern special chars (%, _) so the term is matched literally. */
function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export interface ProductListFilters {
  page?: number;
  limit?: number;
  category?: string;
  gender?: string;
  productType?: string;
  tag?: string;        // 'bestseller' | 'trending' | 'new'
  sort?: string;       // 'price-low' | 'price-high' | 'rating' | 'featured'
}

export interface PaginatedProducts {
  products: ProductWithSizes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminDashboardSummary {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  deliveredOrders: number;
  totalProducts: number;
  activeProducts: number;
  lowStockSizes: number;
}

export interface AdminProductListFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AdminOrderListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface AdminPaginatedProducts {
  products: ProductWithSizes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminPaginatedOrders {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IStorage {
  // All tenant-scoped methods take tenantId as first param
  getProducts(tenantId: number): Promise<ProductWithSizes[]>;
  getProductsPaginated(tenantId: number, filters: ProductListFilters): Promise<PaginatedProducts>;
  getAllProducts(tenantId: number): Promise<ProductWithSizes[]>;
  getAdminProductsPaginated(tenantId: number, filters: AdminProductListFilters): Promise<AdminPaginatedProducts>;
  getProduct(id: number): Promise<ProductWithSizes | undefined>;
  searchProducts(tenantId: number, query: string): Promise<ProductWithSizes[]>;
  getShopFilters(tenantId: number): Promise<ShopFilters>;
  createProduct(tenantId: number, product: InsertProduct, sizes: InsertProductSize[]): Promise<ProductWithSizes>;
  updateProduct(id: number, product: Partial<InsertProduct>, sizes: { id?: number; size: string; price: number; originalPrice: number | null; stock: number }[]): Promise<ProductWithSizes | undefined>;
  updateProductFields(id: number, fields: { enabled?: boolean }): Promise<ProductWithSizes | undefined>;
  deleteProduct(id: number): Promise<void>;

  getReviewsByProduct(productId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;

  getOrder(id: number): Promise<Order | undefined>;
  getOrders(tenantId: number): Promise<Order[]>;
  getAdminOrdersPaginated(tenantId: number, filters: AdminOrderListFilters): Promise<AdminPaginatedOrders>;
  getOrdersByUserId(tenantId: number, userId: string): Promise<Order[]>;
  getOrdersByUserIdOrEmail(tenantId: number, userId: string, email: string): Promise<Order[]>;
  hasOrderedBefore(tenantId: number, userId: string | null, email: string): Promise<boolean>;
  createOrder(tenantId: number, order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  updateOrderPayment(id: number, razorpayPaymentId: string, status: string): Promise<Order | undefined>;
  setOrderRazorpayOrderId(id: number, razorpayOrderId: string): Promise<Order | undefined>;

  getPromotions(tenantId: number): Promise<Promotion[]>;
  createPromotion(tenantId: number, promo: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: number, data: Partial<InsertPromotion>): Promise<Promotion | undefined>;

  getSubscribers(tenantId: number): Promise<Subscriber[]>;
  createSubscriber(tenantId: number, sub: InsertSubscriber): Promise<Subscriber>;

  // Addresses remain user-scoped (no tenantId)
  getAddressesByUserId(userId: string): Promise<Address[]>;
  getAddress(id: number, userId: string): Promise<Address | undefined>;
  createAddress(data: InsertAddress): Promise<Address>;
  updateAddress(id: number, userId: string, data: Partial<InsertAddress>): Promise<Address | undefined>;
  deleteAddress(id: number, userId: string): Promise<{ deleted: boolean; reason?: string }>;
  setDefaultAddress(id: number, userId: string): Promise<void>;

  getSettings(tenantId: number): Promise<Setting[]>;
  getSetting(tenantId: number, key: string): Promise<string | undefined>;
  upsertSetting(tenantId: number, key: string, value: string): Promise<Setting>;
  upsertSettings(tenantId: number, entries: { key: string; value: string }[]): Promise<void>;
  seedDefaultSettings(tenantId?: number): Promise<void>;
  getAdminDashboardSummary(tenantId: number): Promise<AdminDashboardSummary>;
}

export class DatabaseStorage implements IStorage {
  async getProducts(tenantId: number): Promise<ProductWithSizes[]> {
    const allProducts = await db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.enabled, true)));
    const allSizes = await db.select().from(productSizes);
    return allProducts.map((p) => ({
      ...p,
      sizes: allSizes.filter((s) => s.productId === p.id),
    }));
  }

  async getProductsPaginated(tenantId: number, filters: ProductListFilters): Promise<PaginatedProducts> {
    const pageNum = Math.max(1, Math.floor(filters.page ?? 1));
    const limitNum = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 20)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: ReturnType<typeof eq>[] = [
      eq(products.tenantId, tenantId),
      eq(products.enabled, true),
    ];

    if (filters.category) {
      const pattern = `%${escapeLikePattern(filters.category)}%`;
      conditions.push(sql`${products.category} ILIKE ${pattern}` as any);
    }
    if (filters.gender) {
      conditions.push(sql`lower(${products.gender}) = lower(${filters.gender})` as any);
    }
    if (filters.productType) {
      conditions.push(sql`lower(${products.productType}) = lower(${filters.productType})` as any);
    }
    if (filters.tag === "bestseller") conditions.push(eq(products.isBestseller, true));
    else if (filters.tag === "trending") conditions.push(eq(products.isTrending, true));
    else if (filters.tag === "new") conditions.push(eq(products.isNewArrival, true));

    const whereClause = and(...conditions);

    const [countRow] = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);
    const totalCount = Number(countRow?.count ?? 0);

    let orderClause;
    if (filters.sort === "rating") {
      orderClause = desc(products.avgRating);
    } else {
      orderClause = asc(products.id);
    }

    const pageProducts = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limitNum)
      .offset(offset);

    const productIds = pageProducts.map((p) => p.id);
    const sizes = productIds.length > 0
      ? await db.select().from(productSizes).where(sql`${productSizes.productId} = ANY(ARRAY[${sql.join(productIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : [];

    const productsWithSizes: ProductWithSizes[] = pageProducts.map((p) => ({
      ...p,
      sizes: sizes.filter((s) => s.productId === p.id),
    }));

    if (filters.sort === "price-low") {
      productsWithSizes.sort((a, b) => {
        const minA = a.sizes.length ? Math.min(...a.sizes.map((s) => s.price)) : 0;
        const minB = b.sizes.length ? Math.min(...b.sizes.map((s) => s.price)) : 0;
        return minA - minB;
      });
    } else if (filters.sort === "price-high") {
      productsWithSizes.sort((a, b) => {
        const minA = a.sizes.length ? Math.min(...a.sizes.map((s) => s.price)) : 0;
        const minB = b.sizes.length ? Math.min(...b.sizes.map((s) => s.price)) : 0;
        return minB - minA;
      });
    }

    return {
      products: productsWithSizes,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    };
  }

  async getAllProducts(tenantId: number): Promise<ProductWithSizes[]> {
    const allProducts = await db.select().from(products).where(eq(products.tenantId, tenantId));
    const allSizes = await db.select().from(productSizes);
    return allProducts.map((p) => ({
      ...p,
      sizes: allSizes.filter((s) => s.productId === p.id),
    }));
  }

  async getAdminProductsPaginated(tenantId: number, filters: AdminProductListFilters): Promise<AdminPaginatedProducts> {
    const pageNum = Math.max(1, Math.floor(filters.page ?? 1));
    const limitNum = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 20)));
    const offset = (pageNum - 1) * limitNum;
    const conditions: any[] = [eq(products.tenantId, tenantId)];

    if (filters.search) {
      const pattern = `%${escapeLikePattern(filters.search)}%`;
      conditions.push(
        or(
          sql`${products.name} ILIKE ${pattern}`,
          sql`${products.category} ILIKE ${pattern}`,
          sql`${products.gender} ILIKE ${pattern}`,
          sql`${products.productType} ILIKE ${pattern}`
        ) as any
      );
    }

    const whereClause = and(...conditions);
    const [countRow] = await db.select({ count: count() }).from(products).where(whereClause);
    const totalCount = Number(countRow?.count ?? 0);

    const pageProducts = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.id))
      .limit(limitNum)
      .offset(offset);

    const productIds = pageProducts.map((product) => product.id);
    const sizes = productIds.length > 0
      ? await db.select().from(productSizes).where(sql`${productSizes.productId} = ANY(ARRAY[${sql.join(productIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : [];

    return {
      products: pageProducts.map((product) => ({
        ...product,
        sizes: sizes.filter((size) => size.productId === product.id),
      })),
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    };
  }

  async getProduct(id: number): Promise<ProductWithSizes | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.enabled, true)));
    if (!product) return undefined;
    const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, id));
    return { ...product, sizes };
  }

  async searchProducts(tenantId: number, query: string): Promise<ProductWithSizes[]> {
    const normalized = (query || "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!normalized) return [];
    const tokens = normalized.split(" ").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    if (tokens.length === 0) return [];

    const conditions = tokens.map((token) => {
      const pattern = `%${escapeLikePattern(token)}%`;
      return or(
        sql`${products.name} ILIKE ${pattern}`,
        sql`${products.category} ILIKE ${pattern}`,
        sql`${products.productType} ILIKE ${pattern}`,
        sql`${products.description} ILIKE ${pattern}`,
        sql`array_to_string(${products.notes}, ' ') ILIKE ${pattern}`,
      );
    });

    const allProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.enabled, true), ...conditions));
    const allSizes = await db.select().from(productSizes);
    return allProducts.map((p) => ({
      ...p,
      sizes: allSizes.filter((s) => s.productId === p.id),
    }));
  }

  async getShopFilters(tenantId: number): Promise<ShopFilters> {
    const allProducts = await db
      .select({ category: products.category, gender: products.gender, productType: products.productType })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.enabled, true)));
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

  async createProduct(tenantId: number, product: InsertProduct, sizes: InsertProductSize[]): Promise<ProductWithSizes> {
    const [created] = await db.insert(products).values({ ...product, tenantId }).returning();
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

  async getOrders(tenantId: number): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.tenantId, tenantId)).orderBy(desc(orders.createdAt));
  }

  async getAdminOrdersPaginated(tenantId: number, filters: AdminOrderListFilters): Promise<AdminPaginatedOrders> {
    const pageNum = Math.max(1, Math.floor(filters.page ?? 1));
    const limitNum = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 20)));
    const offset = (pageNum - 1) * limitNum;
    const conditions: any[] = [eq(orders.tenantId, tenantId)];

    if (filters.status && filters.status !== "all") {
      conditions.push(eq(orders.status, filters.status));
    }

    if (filters.search) {
      const pattern = `%${escapeLikePattern(filters.search)}%`;
      conditions.push(
        or(
          sql`${orders.customerName} ILIKE ${pattern}`,
          sql`${orders.phone} ILIKE ${pattern}`,
          sql`CAST(${orders.id} AS TEXT) ILIKE ${pattern}`
        ) as any
      );
    }

    const whereClause = and(...conditions);
    const [countRow] = await db.select({ count: count() }).from(orders).where(whereClause);
    const totalCount = Number(countRow?.count ?? 0);

    const pageOrders = await db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limitNum)
      .offset(offset);

    return {
      orders: pageOrders,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    };
  }

  async getOrdersByUserId(tenantId: number, userId: string): Promise<Order[]> {
    return db.select().from(orders).where(and(eq(orders.tenantId, tenantId), eq(orders.userId, userId))).orderBy(desc(orders.createdAt));
  }

  async hasOrderedBefore(tenantId: number, userId: string | null, email: string): Promise<boolean> {
    const uid = userId || "";
    const ordersFound = await this.getOrdersByUserIdOrEmail(tenantId, uid, email);
    return ordersFound.length > 0;
  }

  async getOrdersByUserIdOrEmail(tenantId: number, userId: string, email: string): Promise<Order[]> {
    const byUser = await db.select().from(orders).where(and(eq(orders.tenantId, tenantId), eq(orders.userId, userId))).orderBy(desc(orders.createdAt));
    const byEmail = email
      ? await db
          .select()
          .from(orders)
          .where(and(eq(orders.tenantId, tenantId), isNull(orders.userId), sql`lower(${orders.email}) = lower(${email})`))
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

  async createOrder(tenantId: number, order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values({ ...order, tenantId }).returning();
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

  async getPromotions(tenantId: number): Promise<Promotion[]> {
    return db.select().from(promotions).where(eq(promotions.tenantId, tenantId));
  }

  async createPromotion(tenantId: number, promo: InsertPromotion): Promise<Promotion> {
    const [created] = await db.insert(promotions).values({ ...promo, tenantId }).returning();
    return created;
  }

  async updatePromotion(id: number, data: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updated] = await db.update(promotions).set(data).where(eq(promotions.id, id)).returning();
    return updated;
  }

  async getSubscribers(tenantId: number): Promise<Subscriber[]> {
    return db.select().from(subscribers).where(eq(subscribers.tenantId, tenantId)).orderBy(desc(subscribers.createdAt));
  }

  async createSubscriber(tenantId: number, sub: InsertSubscriber): Promise<Subscriber> {
    const [created] = await db.insert(subscribers).values({ ...sub, tenantId }).returning();
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

  async getSettings(tenantId: number): Promise<Setting[]> {
    return db.select().from(settings).where(eq(settings.tenantId, tenantId)).orderBy(settings.key);
  }

  async getSetting(tenantId: number, key: string): Promise<string | undefined> {
    const [row] = await db.select().from(settings).where(and(eq(settings.tenantId, tenantId), eq(settings.key, key)));
    return row?.value;
  }

  async upsertSetting(tenantId: number, key: string, value: string): Promise<Setting> {
    const [row] = await db
      .insert(settings)
      .values({ tenantId, key, value, label: key, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async upsertSettings(tenantId: number, entries: { key: string; value: string }[]): Promise<void> {
    for (const { key, value } of entries) {
      await db
        .insert(settings)
        .values({ tenantId, key, value, label: key, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [settings.tenantId, settings.key],
          set: { value, updatedAt: new Date() },
        });
    }
  }

  async seedDefaultSettings(tenantId: number = 1): Promise<void> {
    const defaults: Omit<Setting, "id" | "updatedAt">[] = [
      { tenantId, key: "shipping_fee",            value: "99",                        label: "Shipping Fee (₹)",              description: "Flat shipping fee charged per order",          type: "number" },
      { tenantId, key: "free_shipping_threshold", value: "1499",                      label: "Free Shipping Threshold (₹)",   description: "Order subtotal above which shipping is free",   type: "number" },
      { tenantId, key: "store_name",              value: "ISHQARA",                   label: "Store Name",                    description: "Displayed across the site and in UPI payments", type: "string" },
      { tenantId, key: "store_email",             value: "ishqaraperfumes@gmail.com", label: "Support Email",                 description: "Contact / support email",                       type: "string" },
      { tenantId, key: "store_phone",             value: "+91 98679 02305",           label: "Support Phone",                 description: "WhatsApp / support phone number",               type: "string" },
      { tenantId, key: "upi_business_name",       value: "ISHQARA",                   label: "UPI Business Name",             description: "Name shown in UPI payment screens",             type: "string" },
      { tenantId, key: "upi_merchant_mode",       value: "false",                     label: "UPI ID Type",                 description: "Personal UPI ID, Merchant UPI ID", type: "boolean" },
      { tenantId, key: "upi_id",                  value: "",                          label: "UPI ID",                        description: "Business UPI VPA e.g. ishqara@upi",             type: "string" },
      { tenantId, key: "upi_merchant_code",       value: "5999",                      label: "UPI Merchant Code (MCC)",       description: "4-digit MCC for merchant mode only (Only enter if UPI is a merchant VPA)", type: "string" },
      { tenantId, key: "cod_enabled",             value: "false",                     label: "Cash on Delivery",              description: "Enable or disable Cash on Delivery option",     type: "boolean" },
      { tenantId, key: "min_order_amount",        value: "0",                         label: "Minimum Order Amount (₹)",      description: "Minimum cart value required to place an order",  type: "number" },
      { tenantId, key: "razorpay_enabled",        value: "true",                      label: "Pay via Razorpay",              description: "Show Card / Net Banking (Razorpay) option at checkout", type: "boolean" },
      { tenantId, key: "badge_delivery_enabled",   value: "true",                      label: "Show Free Delivery Badge",      description: "Show delivery badge on product page", type: "boolean" },
      { tenantId, key: "badge_delivery_text",     value: "Free Delivery ₹{amount}+",   label: "Delivery Badge Text",           description: "Use {amount} for free shipping threshold", type: "string" },
      { tenantId, key: "badge_returns_enabled",   value: "true",                      label: "Show Returns Badge",            description: "Show returns badge on product page", type: "boolean" },
      { tenantId, key: "badge_returns_text",       value: "7-Day Returns",             label: "Returns Badge Text",            description: "Custom text for returns badge", type: "string" },
      { tenantId, key: "badge_authentic_enabled",  value: "true",                      label: "Show Authentic Badge",          description: "Show authenticity badge on product page", type: "boolean" },
      { tenantId, key: "badge_authentic_text",    value: "100% Authentic",            label: "Authentic Badge Text",           description: "Custom text for authenticity badge", type: "string" },
      // Feature toggles
      { tenantId, key: "feature_deals_enabled",   value: "true",  label: "Deals Page",            description: "Show Deals & Offers page and nav link",       type: "boolean" },
      { tenantId, key: "feature_bundles_enabled",  value: "true",  label: "Bundles Page",           description: "Show Build Your Bundle page",                  type: "boolean" },
      { tenantId, key: "feature_reviews_enabled",  value: "true",  label: "Product Reviews",        description: "Show customer reviews on product pages",       type: "boolean" },
      { tenantId, key: "feature_subscribe_popup_enabled", value: "true", label: "Subscribe Popup", description: "Show email/WhatsApp subscribe popup",          type: "boolean" },
      { tenantId, key: "feature_bundle_config",   value: '[{"count":2,"discount":10,"label":"Pick 2"},{"count":3,"discount":15,"label":"Pick 3"}]', label: "Bundle Config (JSON)", description: "Array of bundle options: count, discount %, label", type: "string" },
      // Content / Copy
      { tenantId, key: "copy_hero_badge",         value: "New Collection 2026",       label: "Hero Badge Text",              description: "Small badge above hero title",                  type: "string" },
      { tenantId, key: "copy_hero_title",         value: "Love, bottled. Meet {store}.", label: "Hero Title",                description: "Main hero heading. Use {store} for store name", type: "string" },
      { tenantId, key: "copy_hero_tagline",       value: "Not just a perfume. A presence.", label: "Hero Tagline",           description: "Subheading below hero title",                   type: "string" },
      { tenantId, key: "copy_hero_description",   value: "Discover premium fragrances that make every day special. Starting at just Rs. 499.", label: "Hero Description", description: "Paragraph text below tagline", type: "string" },
      { tenantId, key: "copy_hero_cta",           value: "Shop Now",                  label: "Hero CTA Button",              description: "Main call-to-action button text",               type: "string" },
      { tenantId, key: "copy_footer_tagline",     value: "Experience {store} today: A scent that stays longer than words.\nTry it. Love it. Wear it.", label: "Footer Tagline", description: "Footer brand description. Use {store} for store name", type: "string" },
      { tenantId, key: "copy_subscribe_title",    value: "Get 10% Off",               label: "Subscribe Popup Title",        description: "Headline of the subscribe popup",               type: "string" },
      { tenantId, key: "copy_subscribe_body",     value: "Join the {store} family and get an exclusive discount on your first order", label: "Subscribe Popup Body", description: "Body text. Use {store} for store name", type: "string" },
      { tenantId, key: "copy_subscribe_promo_code", value: "FIRST10",                 label: "Subscribe Promo Code",         description: "Promo code shown after subscribing",            type: "string" },
      { tenantId, key: "copy_cart_empty_title",   value: "Your Bag is Empty",         label: "Empty Cart Title",             description: "Heading when cart is empty",                    type: "string" },
      { tenantId, key: "copy_cart_empty_body",    value: "Looks like you haven't added any fragrances yet. Let's fix that!", label: "Empty Cart Body", description: "Body text when cart is empty", type: "string" },
      { tenantId, key: "copy_deals_title",        value: "Deals & Offers",            label: "Deals Page Title",             description: "Heading on the deals page",                     type: "string" },
      { tenantId, key: "copy_deals_subtitle",     value: "Grab these exclusive deals before they're gone", label: "Deals Page Subtitle", description: "Subheading on the deals page", type: "string" },
      { tenantId, key: "copy_bundle_title",       value: "Build Your Own Bundle",     label: "Bundle Page Title",            description: "Heading on the bundle page",                    type: "string" },
      { tenantId, key: "copy_bundle_subtitle",    value: "Pick your favorite fragrances and save big. Perfect for gifting or treating yourself!", label: "Bundle Page Subtitle", description: "Subheading on the bundle page", type: "string" },
      // Social links
      { tenantId, key: "social_instagram_url",    value: "",                          label: "Instagram URL",                description: "Full Instagram profile URL",                    type: "string" },
      { tenantId, key: "social_whatsapp_number",  value: "",                          label: "WhatsApp Number",              description: "WhatsApp number (with country code, e.g. 919867902305)", type: "string" },
      // Contact
      { tenantId, key: "contact_address",         value: "Mumbai, Maharashtra, India", label: "Business Address",            description: "Physical address shown on contact page",        type: "string" },
      { tenantId, key: "contact_hours",           value: "Monday to Saturday, 10:00 am – 6:00 pm IST", label: "Business Hours", description: "Customer service hours shown on contact page", type: "string" },
    ];
    for (const d of defaults) {
      await db
        .insert(settings)
        .values({ ...d, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [settings.tenantId, settings.key],
          set: { label: d.label, description: d.description ?? null, type: d.type, updatedAt: new Date() },
        });
    }
  }

  async getAdminDashboardSummary(tenantId: number): Promise<AdminDashboardSummary> {
    const tenantProducts = await db
      .select({
        enabled: products.enabled,
        lowStockCount: sql<number>`(
          SELECT COUNT(*)
          FROM ${productSizes}
          WHERE ${productSizes.productId} = ${products.id}
            AND ${productSizes.stock} <= 5
        )`,
      })
      .from(products)
      .where(eq(products.tenantId, tenantId));

    const tenantOrders = await db
      .select({
        total: orders.total,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId));

    return {
      totalRevenue: tenantOrders.reduce((sum, order) => sum + order.total, 0),
      totalOrders: tenantOrders.length,
      pendingOrders: tenantOrders.filter((order) => order.status === "pending").length,
      inProgressOrders: tenantOrders.filter((order) => order.status === "confirmed" || order.status === "shipped").length,
      deliveredOrders: tenantOrders.filter((order) => order.status === "delivered").length,
      totalProducts: tenantProducts.length,
      activeProducts: tenantProducts.filter((product) => product.enabled !== false).length,
      lowStockSizes: tenantProducts.reduce((sum, product) => sum + Number(product.lowStockCount ?? 0), 0),
    };
  }
}

export const storage = new DatabaseStorage();
