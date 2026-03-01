import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean } from "drizzle-orm/pg-core";

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

// User storage: email/password, Google OAuth, WhatsApp (phone) auth.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  phone: varchar("phone").unique(),
  provider: varchar("provider").notNull().default("email"), // 'email' | 'google' | 'whatsapp'
  isAdmin: boolean("is_admin").notNull().default(false),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  googleId: varchar("google_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
