import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Settings, ToggleLeft, FileText, Share2,
  Users, CreditCard, Globe, ExternalLink, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import SEOHead from "@/components/SEOHead";
import type { EnrichedTenant } from "./components/TenantsTable";

import GeneralSection from "./sections/GeneralSection";
import FeaturesSection from "./sections/FeaturesSection";
import ContentSection from "./sections/ContentSection";
import SocialContactSection from "./sections/SocialContactSection";
import MembersSection from "./sections/MembersSection";
import BillingSection from "./sections/BillingSection";
import DomainSection from "./sections/DomainSection";

type SectionKey = "general" | "features" | "content" | "social" | "members" | "billing" | "domain";

const NAV_ITEMS: { key: SectionKey; label: string; icon: typeof Settings }[] = [
  { key: "general", label: "General", icon: Settings },
  { key: "features", label: "Features", icon: ToggleLeft },
  { key: "content", label: "Content", icon: FileText },
  { key: "social", label: "Social & Contact", icon: Share2 },
  { key: "members", label: "Members", icon: Users },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "domain", label: "Domain", icon: Globe },
];

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [section, setSection] = useState<SectionKey>("general");

  const { data: tenants = [], isLoading } = useQuery<EnrichedTenant[]>({
    queryKey: ["/api/super-admin/tenants"],
  });

  const tenant = tenants.find((t) => t.id === Number(id));

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="border-b bg-background">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <Skeleton className="h-8 w-56" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
          <Skeleton className="w-52 h-96 shrink-0 rounded-xl" />
          <Skeleton className="flex-1 h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user?.isSuperAdmin) {
    navigate("/platform");
    return null;
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Tenant not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/platform")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SEOHead title={`${tenant.name} — Platform Admin`} description="Tenant configuration" noIndex />

      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/platform")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {tenant.logo ? (
                <img src={tenant.logo} alt={tenant.name} className="h-8 w-8 rounded-lg border object-contain bg-white p-0.5 shrink-0" />
              ) : (
                <div
                  className="h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 text-xs font-bold text-white"
                  style={{ backgroundColor: tenant.brandColor ?? "#6366f1" }}
                >
                  {tenant.name[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold truncate">{tenant.name}</h1>
                  <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline">{tenant.slug}</code>
                  {!tenant.isActive && (
                    <Badge variant="secondary" className="text-[9px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Inactive</Badge>
                  )}
                </div>
                {tenant.domain && (
                  <a
                    href={`https://${tenant.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-muted-foreground flex items-center gap-0.5 hover:underline"
                  >
                    {tenant.domain}
                    {tenant.domainVerified
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      : <AlertTriangle className="h-3 w-3 text-amber-500" />
                    }
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick stats in header */}
            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
              <div className="text-center">
                <p className="font-semibold text-foreground tabular-nums">{tenant.productCount}</p>
                <p>Products</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground tabular-nums">{tenant.orderCount}</p>
                <p>Orders</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground tabular-nums">{tenant.memberCount}</p>
                <p>Members</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground tabular-nums">₹{(tenant.billingCollected ?? 0).toLocaleString("en-IN")}</p>
                <p>Collected</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 hidden md:block">
          <div className="sticky top-[73px] space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-background shadow-sm font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {item.key === "members" && (
                    <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">{tenant.memberCount}</Badge>
                  )}
                  {item.key === "domain" && tenant.domain && (
                    tenant.domainVerified
                      ? <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500" />
                      : <AlertTriangle className="ml-auto h-3.5 w-3.5 text-amber-500" />
                  )}
                  {item.key === "billing" && (tenant.billingOverdue ?? 0) > 0 && (
                    <AlertTriangle className="ml-auto h-3.5 w-3.5 text-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile section selector */}
        <div className="md:hidden w-full">
          <ScrollArea className="w-full pb-3">
            <div className="flex gap-1.5 mb-4">
              {NAV_ITEMS.map((item) => {
                const active = section === item.key;
                return (
                  <Button
                    key={item.key}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="text-xs shrink-0"
                    onClick={() => setSection(item.key)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
          <SectionContent tenant={tenant} section={section} />
        </div>

        {/* Desktop content */}
        <div className="flex-1 min-w-0 hidden md:block">
          <div className="bg-background rounded-xl border p-6">
            <SectionContent tenant={tenant} section={section} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionContent({ tenant, section }: { tenant: EnrichedTenant; section: SectionKey }) {
  switch (section) {
    case "general": return <GeneralSection tenant={tenant} />;
    case "features": return <FeaturesSection tenantId={tenant.id} />;
    case "content": return <ContentSection tenantId={tenant.id} />;
    case "social": return <SocialContactSection tenantId={tenant.id} />;
    case "members": return <MembersSection tenantId={tenant.id} />;
    case "billing": return <BillingSection tenant={tenant} />;
    case "domain": return <DomainSection tenant={tenant} />;
    default: return null;
  }
}
