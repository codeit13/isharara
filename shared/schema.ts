import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, jsonb, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("ISHQARA"),
  description: text("description").notNull(),
  category: text("category").notNull(),
  notes: text("notes").array().notNull(),
  image: text("image").notNull(),
  images: text("images").array().notNull().default([]), // gallery URLs; image = primary (first)
  isBestseller: boolean("is_bestseller").notNull().default(false),
  isTrending: boolean("is_trending").notNull().default(false),
  isNewArrival: boolean("is_new_arrival").notNull().default(false),
  gender: text("gender").notNull().default("unisex"),
  productType: text("product_type").notNull().default("og"), // 'og' | 'recreation'
  enabled: boolean("enabled").notNull().default(true),
  avgRating: decimal("avg_rating", { precision: 2, scale: 1 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
});

export const productSizes = pgTable("product_sizes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  size: text("size").notNull(),
  price: integer("price").notNull(),
  originalPrice: integer("original_price"),
  stock: integer("stock").notNull().default(0),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  userId: varchar("user_id"),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  pincode: text("pincode").notNull(),
  items: jsonb("items").notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull().default("pending"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  label: text("label").notNull().default("Home"),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull().default(""),
  pincode: text("pincode").notNull(),
  country: text("country").notNull().default("India"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  title: text("title").notNull(),
  description: text("description").notNull(),
  discountType: text("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  code: text("code"),
  isActive: boolean("is_active").notNull().default(true),
  firstOrderOnly: boolean("first_order_only").notNull().default(false),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
});

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  email: text("email"),
  phone: text("phone"),
  source: text("source").notNull().default("popup"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  key: text("key").notNull(),
  value: text("value").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  type: text("type").notNull().default("string"), // 'string' | 'number' | 'boolean'
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("settings_tenant_key_idx").on(table.tenantId, table.key)]);

export type Setting = typeof settings.$inferSelect;

export const insertAddressSchema = createInsertSchema(addresses).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertProductSizeSchema = createInsertSchema(productSizes).omit({ id: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, status: true });
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true });
export const insertSubscriberSchema = createInsertSchema(subscribers).omit({ id: true, createdAt: true });

export type Address = typeof addresses.$inferSelect;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductSize = typeof productSizes.$inferSelect;
export type InsertProductSize = z.infer<typeof insertProductSizeSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Subscriber = typeof subscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;

export type CartItem = {
  productId: number;
  name: string;
  image: string;
  size: string;
  price: number;
  quantity: number;
};

export type ProductWithSizes = Product & {
  sizes: ProductSize[];
};
