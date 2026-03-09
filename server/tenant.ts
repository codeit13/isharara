import type { RequestHandler } from "express";
import { db } from "./db";
import { tenants, type Tenant } from "@shared/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenant: Tenant;
    }
  }
}

const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "ishqara";

// In-memory cache: domain/slug → { tenant, expiresAt }
const cache = new Map<string, { tenant: Tenant; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

async function lookupTenant(domain: string): Promise<Tenant | null> {
  const now = Date.now();
  const cached = cache.get(domain);
  if (cached && cached.expiresAt > now) return cached.tenant;

  // Try matching by domain first
  const [byDomain] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.domain, domain));
  if (byDomain && byDomain.isActive) {
    cache.set(domain, { tenant: byDomain, expiresAt: now + CACHE_TTL_MS });
    return byDomain;
  }

  return null;
}

async function getDefaultTenant(): Promise<Tenant> {
  const cached = cache.get(`__default__${DEFAULT_TENANT_SLUG}`);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, DEFAULT_TENANT_SLUG));
  if (!tenant) throw new Error(`Default tenant "${DEFAULT_TENANT_SLUG}" not found in database`);
  cache.set(`__default__${DEFAULT_TENANT_SLUG}`, {
    tenant,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return tenant;
}

export const resolveTenant: RequestHandler = async (req, _res, next) => {
  try {
    const hostname = (req.hostname || req.get("host") || "").split(":")[0].toLowerCase();

    const tenant = await lookupTenant(hostname);
    if (tenant) {
      req.tenant = tenant;
      return next();
    }

    // Fallback to default tenant (covers localhost, dev, unknown domains)
    req.tenant = await getDefaultTenant();
    next();
  } catch (err) {
    next(err);
  }
};

export function invalidateTenantCache(domain?: string) {
  if (domain) {
    cache.delete(domain);
  } else {
    cache.clear();
  }
}
