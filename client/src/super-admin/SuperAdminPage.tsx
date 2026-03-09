import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import SEOHead from "@/components/SEOHead";
import PlatformStats from "./components/PlatformStats";
import TenantsTable from "./components/TenantsTable";

export default function SuperAdminPage() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-56 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Access denied</h1>
        <p className="text-muted-foreground text-sm mb-6">
          You need super admin privileges to access the platform dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button variant="outline">Back to store</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SEOHead title="Platform Admin" description="Super admin dashboard" noIndex />

      {/* Header */}
      <div className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Platform Dashboard</h1>
                <p className="text-xs text-muted-foreground">Manage all tenants and platform settings</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Signed in as</span>
              <span className="font-medium text-foreground">{user.email ?? user.phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PlatformStats />
        <Separator />
        <TenantsTable />
      </div>
    </div>
  );
}
