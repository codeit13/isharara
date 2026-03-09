import { useQuery } from "@tanstack/react-query";

export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  brandColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  domain: string | null;
  domainVerified: boolean;
}

export function useTenant() {
  const { data: tenant } = useQuery<TenantInfo>({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) throw new Error("Failed to fetch tenant");
      return res.json();
    },
    staleTime: Infinity,
  });

  return tenant;
}

/** Synchronous slug getter for use outside React (e.g. cart localStorage). */
let _cachedSlug: string | null = null;

export function getTenantSlug(): string {
  if (_cachedSlug) return _cachedSlug;
  try {
    const raw = localStorage.getItem("__tenant_slug");
    if (raw) {
      _cachedSlug = raw;
      return raw;
    }
  } catch {}
  return "ishqara";
}

export function setTenantSlug(slug: string) {
  _cachedSlug = slug;
  try {
    localStorage.setItem("__tenant_slug", slug);
  } catch {}
}
