import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, serial, integer, text } from "drizzle-orm/pg-core";

// Session storage table (used by express-session with connect-pg-simple).
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// ── Tenants ──────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain").unique(),
  logo: text("logo"),
  brandColor: text("brand_color"),
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),
  isActive: boolean("is_active").notNull().default(true),
  domainVerified: boolean("domain_verified").notNull().default(false),
  domainVerifiedAt: timestamp("domain_verified_at"),
  // Billing
  setupFee: integer("setup_fee"),
  retainerAmount: integer("retainer_amount"),
  billingCycle: text("billing_cycle"), // 'monthly' | 'yearly' | 'one-time' | null
  billingStartDate: timestamp("billing_start_date"),
  nextDueDate: timestamp("next_due_date"),
  currency: text("currency").notNull().default("INR"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ── Tenant payments ledger ──────────────────────────────────────────────────
export const tenantPayments = pgTable("tenant_payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  type: text("type").notNull(), // 'setup' | 'retainer' | 'addon' | 'refund' | 'custom'
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("pending"), // 'paid' | 'pending' | 'overdue' | 'waived'
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TenantPayment = typeof tenantPayments.$inferSelect;
export type InsertTenantPayment = typeof tenantPayments.$inferInsert;

// User storage: email/password, Google OAuth, WhatsApp (phone) auth.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  phone: varchar("phone").unique(),
  provider: varchar("provider").notNull().default("email"), // 'email' | 'google' | 'whatsapp'
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  googleId: varchar("google_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Tenant membership (per-tenant roles) ─────────────────────────────────────
export const tenantMembers = pgTable("tenant_members", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("staff"), // 'owner' | 'admin' | 'staff'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TenantMember = typeof tenantMembers.$inferSelect;
export type InsertTenantMember = typeof tenantMembers.$inferInsert;

// OTP for WhatsApp/phone login (phone number → OTP, expires)
export const otpVerifications = pgTable(
  "otp_verifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    phone: varchar("phone").notNull(),
    otp: varchar("otp").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("IDX_otp_phone").on(table.phone), index("IDX_otp_expires").on(table.expiresAt)]
);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
