import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { authStorage } from "./storage";
import type { User } from "@shared/models/auth";

const DEMO_USER_ID = "demo";

export function getSession(): ReturnType<typeof session> {
  const secret = process.env.SESSION_SECRET || "local-dev-secret-change-in-production";
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

function toPublicUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash, ...rest } = user;
  return rest;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
    interface User {
      id: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      profileImageUrl?: string | null;
      phone?: string | null;
      provider?: string | null;
      isAdmin?: boolean;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function setupAuth(app: Express): Promise<void> {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());

  // ----- Passport: Local (email/password) -----
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email: string, password: string, done: (err: unknown, user?: User | false, info?: { message: string }) => void) => {
        try {
          const user = await authStorage.getUserByEmail(email);
          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }
          const ok = await authStorage.verifyPassword(password, user.passwordHash);
          if (!ok) return done(null, false, { message: "Invalid email or password" });
          return done(null, user);
        } catch (e) {
          return done(e);
        }
      }
    )
  );

  // ----- Passport: Google OAuth -----
  const googleClientID = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.BASE_URL || "http://localhost:3001";

  if (googleClientID && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientID,
          clientSecret: googleClientSecret,
          callbackURL: `${baseUrl}/api/auth/google/callback`,
        },
        async (_accessToken: string, _refreshToken: string, profile: Profile, done: (err: unknown, user?: User) => void) => {
          try {
            const googleId = profile.id;
            let user = await authStorage.getUserByGoogleId(googleId);
            if (user) {
              return done(null, user);
            }
            const email = profile.emails?.[0]?.value || null;
            const displayName = profile.displayName || "";
            const parts = displayName.split(" ");
            const firstName = parts[0] || null;
            const lastName = parts.slice(1).join(" ") || null;
            const photo = profile.photos?.[0]?.value || null;
            user = await authStorage.upsertUser({
              email,
              googleId,
              provider: "google",
              firstName,
              lastName,
              profileImageUrl: photo,
            });
            return done(null, user);
          } catch (e) {
            return done(e);
          }
        }
      )
    );
  }

  // ----- Register (email/password) -----
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body || {};
      if (!email || typeof email !== "string" || !password || typeof password !== "string") {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const trimmedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const existing = await authStorage.getUserByEmail(trimmedEmail);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const user = await authStorage.createUser({
        email: trimmedEmail,
        password,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      });
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        res.status(201).json({ user: toPublicUser(user) });
      });
    } catch (e: any) {
      console.error("Register error:", e);
      res.status(500).json({ message: e.message || "Registration failed" });
    }
  });

  // ----- Login (email/password) -----
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", { session: false }, (err: any, user: User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }
      (req.session as any).userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Session save failed" });
        res.json({ user: toPublicUser(user) });
      });
    })(req, res, next);
  });

  // ----- Google OAuth -----
  app.get("/api/auth/google", (req, res, next) => {
    if (!googleClientID || !googleClientSecret) {
      return res.status(503).json({ message: "Google login is not configured" });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", { session: false }, (err: any, user: User | false) => {
      if (err) {
        console.error("Google OAuth error:", err);
        return res.redirect("/login?error=google");
      }
      if (!user) return res.redirect("/login?error=google");
      (req.session as any).userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.redirect("/login?error=session");
        }
        res.redirect("/");
      });
    })(req, res, next);
  });

  // ----- WhatsApp / Phone OTP -----
  function generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  app.post("/api/auth/whatsapp/send-otp", async (req, res) => {
    try {
      const { phone } = req.body || {};
      const raw = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
      if (raw.length < 10) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }
      const phoneNum = raw.length > 10 ? raw : `91${raw}`;
      const otp = generateOtp();
      await authStorage.setOtp(phoneNum, otp);
      // In production: send OTP via WhatsApp Business API or SMS (e.g. Twilio).
      // For development we return the OTP so the client can show it or user can paste it.
      const isDev = process.env.NODE_ENV !== "production";
      res.json({
        sent: true,
        expiresIn: 300,
        ...(isDev && { devOtp: otp }),
      });
    } catch (e: any) {
      console.error("Send OTP error:", e);
      res.status(500).json({ message: e.message || "Failed to send OTP" });
    }
  });

  app.post("/api/auth/whatsapp/verify-otp", async (req, res) => {
    try {
      const { phone, otp } = req.body || {};
      const raw = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
      if (raw.length < 10 || !otp || String(otp).length !== 6) {
        return res.status(400).json({ message: "Phone and 6-digit OTP are required" });
      }
      const phoneNum = raw.length > 10 ? raw : `91${raw}`;
      const valid = await authStorage.getValidOtp(phoneNum);
      if (!valid || valid.otp !== String(otp).trim()) {
        return res.status(401).json({ message: "Invalid or expired OTP" });
      }
      await authStorage.deleteOtp(phoneNum);
      let user = await authStorage.getUserByPhone(phoneNum);
      if (!user) {
        user = await authStorage.upsertUser({
          phone: phoneNum,
          provider: "whatsapp",
        });
      }
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        res.json({ user: toPublicUser(user) });
      });
    } catch (e: any) {
      console.error("Verify OTP error:", e);
      res.status(500).json({ message: e.message || "Verification failed" });
    }
  });

  // Demo login (optional)
  app.get("/api/login", async (req, res) => {
    const user = await authStorage.getUser(DEMO_USER_ID);
    if (!user) {
      return res.status(503).json({
        message: "Demo user not seeded. Run the app once so the database is seeded.",
      });
    }
    (req.session as any).userId = user.id;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Session save failed" });
      res.redirect("/");
    });
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
  });

  // Current user
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = await authStorage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(toPublicUser(user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await authStorage.getUser(userId);
  if (!user) {
    (req.session as any).userId = undefined;
    req.session.save(() => {});
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.user = user;
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export { authStorage, type IAuthStorage } from "./storage";
