import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Building2, Globe, Users, ShoppingCart, Package,
  ChevronRight, CheckCircle2, XCircle, IndianRupee, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tenant } from "@shared/schema";
import CreateTenantDialog from "./CreateTenantDialog";

export type EnrichedTenant = Tenant & {
  memberCount: number;
  orderCount: number;
  productCount: number;
  orderRevenue: number;
  billingCollected: number;
  billingPending: number;
  billingOverdue: number;
};

export default function TenantsTable() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const { data: tenants = [], isLoading } = useQuery<EnrichedTenant[]>({
    queryKey: ["/api/super-admin/tenants"],
  });

  const filtered = tenants.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.domain ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Tenants
              <Badge variant="secondary" className="ml-1 text-xs">{tenants.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search tenants…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 w-[200px] text-sm"
                />
              </div>
              <CreateTenantDialog />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? "No tenants match your search" : "No tenants yet"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Tenant</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-center">
                    <Tooltip><TooltipTrigger><Package className="h-3.5 w-3.5 mx-auto" /></TooltipTrigger><TooltipContent>Products</TooltipContent></Tooltip>
                  </TableHead>
                  <TableHead className="text-center">
                    <Tooltip><TooltipTrigger><ShoppingCart className="h-3.5 w-3.5 mx-auto" /></TooltipTrigger><TooltipContent>Orders</TooltipContent></Tooltip>
                  </TableHead>
                  <TableHead className="text-center">
                    <Tooltip><TooltipTrigger><Users className="h-3.5 w-3.5 mx-auto" /></TooltipTrigger><TooltipContent>Members</TooltipContent></Tooltip>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <Tooltip><TooltipTrigger><IndianRupee className="h-3.5 w-3.5 ml-auto" /></TooltipTrigger><TooltipContent>Billing Collected</TooltipContent></Tooltip>
                  </TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer group"
                    onClick={() => navigate(`/platform/tenants/${t.id}`)}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-8 w-8 rounded-md border flex items-center justify-center shrink-0 text-xs font-bold text-white"
                          style={{ backgroundColor: t.brandColor ?? "#6366f1" }}
                        >
                          {t.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{t.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.domain ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]">{t.domain}</span>
                          {t.domainVerified ? (
                            <Tooltip><TooltipTrigger><CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /></TooltipTrigger><TooltipContent>DNS Verified</TooltipContent></Tooltip>
                          ) : (
                            <Tooltip><TooltipTrigger><XCircle className="h-3 w-3 text-amber-500 shrink-0" /></TooltipTrigger><TooltipContent>DNS Unverified</TooltipContent></Tooltip>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{t.productCount}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{t.orderCount}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{t.memberCount}</TableCell>
                    <TableCell>
                      {t.isActive ? (
                        <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-[10px]">
                          <XCircle className="h-3 w-3" /> Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.billingOverdue > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent>₹{t.billingOverdue.toLocaleString("en-IN")} overdue</TooltipContent>
                          </Tooltip>
                        )}
                        <span className="font-medium">₹{t.billingCollected.toLocaleString("en-IN")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </>
  );
}
