import { users, otpVerifications, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcrypt";

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
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
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
}

export const authStorage = new AuthStorage();
