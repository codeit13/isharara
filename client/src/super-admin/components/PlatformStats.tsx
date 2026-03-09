import { useQuery } from "@tanstack/react-query";
import { Building2, Users, IndianRupee, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Stats {
  tenants: number;
  users: number;
  orders: number;
  products: number;
  revenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
  overdueCount: number;
  mrr: number;
  arr: number;
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PlatformStats() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/super-admin/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  const hasOverdue = (stats?.overdueCount ?? 0) > 0;

  const items: { label: string; value: string | number; icon: typeof Building2; color: string; sub?: string }[] = [
    { label: "Tenants", value: stats?.tenants ?? 0, icon: Building2, color: "text-violet-600 bg-violet-100 dark:bg-violet-950" },
    { label: "Users", value: stats?.users ?? 0, icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
    { label: "Collected", value: fmt(stats?.revenue ?? 0), icon: IndianRupee, color: "text-green-600 bg-green-100 dark:bg-green-950", sub: "Total paid by clients" },
    {
      label: hasOverdue ? "Overdue" : "Pending",
      value: fmt(hasOverdue ? (stats?.overdueRevenue ?? 0) : (stats?.pendingRevenue ?? 0)),
      icon: hasOverdue ? AlertTriangle : Clock,
      color: hasOverdue
        ? "text-red-600 bg-red-100 dark:bg-red-950"
        : "text-amber-600 bg-amber-100 dark:bg-amber-950",
      sub: hasOverdue
        ? `${stats!.overdueCount} overdue + ${fmt(stats?.pendingRevenue ?? 0)} pending`
        : "Awaiting payment",
    },
    { label: "MRR", value: fmt(stats?.mrr ?? 0), icon: TrendingUp, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950", sub: `ARR: ${fmt(stats?.arr ?? 0)}` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((item) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <Card className="border-0 shadow-sm cursor-default">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium truncate">{item.label}</p>
                    <p className="text-lg font-bold tracking-tight">{item.value}</p>
                    {item.sub && <p className="text-[10px] text-muted-foreground truncate">{item.sub}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          {item.sub && <TooltipContent>{item.sub}</TooltipContent>}
        </Tooltip>
      ))}
    </div>
  );
}
