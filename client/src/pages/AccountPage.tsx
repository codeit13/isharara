import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Clock, CheckCircle2, Truck, XCircle, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { Order } from "@shared/schema";

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Shipped", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-100 text-red-800" },
};

export default function AccountPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated]);

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/my-orders"],
    enabled: isAuthenticated,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const getInitials = () => {
    const first = user?.firstName?.[0] || "";
    const last = user?.lastName?.[0] || "";
    return (first + last).toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" data-testid="page-account">
      <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-6 flex items-center gap-5">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
            <AvatarFallback className="text-lg bg-primary/20 text-primary font-bold">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-serif font-bold" data-testid="text-account-name">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-muted-foreground text-sm" data-testid="text-account-email">
              {user?.email || user?.phone || "Signed in with WhatsApp"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = "/api/logout"; }}
            data-testid="button-account-logout"
          >
            Log Out
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          My Orders
        </h2>

        {ordersLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">No orders yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Your order history will appear here</p>
              <Button
                className="mt-4"
                onClick={() => setLocation("/shop")}
                data-testid="button-start-shopping"
              >
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const orderItems = order.items as Array<{ name: string; size: string; price: number; quantity: number }>;

              return (
                <Card key={order.id} className="overflow-hidden" data-testid={`card-order-${order.id}`}>
                  <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm font-medium" data-testid={`text-order-id-${order.id}`}>
                        Order #{order.id}
                      </CardTitle>
                      <Badge variant="outline" className={`text-xs ${status.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    <div className="space-y-2">
                      {orderItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.name} ({item.size}) x{item.quantity}
                          </span>
                          <span className="font-medium">Rs. {item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {order.paymentMethod === "cod" ? "Cash on Delivery" : "Paid Online"}
                      </span>
                      <span className="font-bold text-primary" data-testid={`text-order-total-${order.id}`}>
                        Rs. {order.total}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
