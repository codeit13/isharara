import { users, otpVerifications, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcrypt";

/** Normalize any Indian phone to canonical 91XXXXXXXXXX (12 digits). */
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 10) return `91${d}`;
  return d;
}

const SALT_ROUNDS = 10;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(data: {
    email: string;
    password: string;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<User>;
  setOtp(phone: string, otp: string): Promise<void>;
  getValidOtp(phone: string): Promise<{ otp: string } | null>;
  deleteOtp(phone: string): Promise<void>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  linkPhone(userId: string, phone: string): Promise<void>;
  linkEmail(userId: string, email: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const normalized = normalizePhone(phone);

    // Try the normalized form first
    const [user] = await db.select().from(users).where(eq(users.phone, normalized));
    if (user) return user;

    // Fallback: legacy rows stored without normalization (e.g. "09027293112")
    // Try the raw digits, 0-prefixed 10-digit, and without country code variants
    const digits10 = normalized.startsWith("91") ? normalized.slice(2) : normalized;
    const candidates = [
      phone.replace(/\D/g, ""),   // raw digits as entered
      `0${digits10}`,             // STD format: 09027293112
      digits10,                   // bare 10 digits
    ].filter((c) => c !== normalized && c.length >= 10);

    for (const alt of candidates) {
      const [found] = await db.select().from(users).where(eq(users.phone, alt));
      if (found) {
        // Migrate the stored phone to the normalized form on-the-fly
        await db.update(users)
          .set({ phone: normalized, updatedAt: new Date() })
          .where(eq(users.id, found.id));
        return { ...found, phone: normalized };
      }
    }

    return undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<User> {
    const passwordHash = await this.hashPassword(data.password);
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        provider: "email",
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
      })
      .returning();
    return user;
  }

  async setOtp(phone: string, otp: string): Promise<void> {
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await db.delete(otpVerifications).where(eq(otpVerifications.phone, phone));
    await db.insert(otpVerifications).values({ phone, otp, expiresAt });
  }

  async getValidOtp(phone: string): Promise<{ otp: string } | null> {
    const now = new Date();
    const [row] = await db
      .select()
      .from(otpVerifications)
      .where(and(eq(otpVerifications.phone, phone), gt(otpVerifications.expiresAt, now)));
    return row ? { otp: row.otp } : null;
  }

  async deleteOtp(phone: string): Promise<void> {
    await db.delete(otpVerifications).where(eq(otpVerifications.phone, phone));
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async linkPhone(userId: string, phone: string): Promise<void> {
    const normalized = normalizePhone(phone);
    const existing = await this.getUserByPhone(normalized);
    if (existing && existing.id !== userId) return; // belongs to another account
    await db.update(users).set({ phone: normalized, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async linkEmail(userId: string, email: string): Promise<void> {
    const existing = await this.getUserByEmail(email.toLowerCase());
    if (existing) return; // email already belongs to another account, skip silently
    await db.update(users).set({ email: email.toLowerCase(), updatedAt: new Date() }).where(eq(users.id, userId));
  }
}

export const authStorage = new AuthStorage();
