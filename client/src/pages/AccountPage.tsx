import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SEOHead from "@/components/SEOHead";
import { useLocation } from "wouter";
import {
  Package, Clock, CheckCircle2, Truck, XCircle,
  MapPin, Plus, Pencil, Trash2, Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Order, Address } from "@shared/schema";

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Shipped", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-100 text-red-800" },
};

const emptyForm = {
  label: "Home",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  isDefault: false,
};

function AddressForm({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial: typeof emptyForm;
  onSave: (data: typeof emptyForm) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof emptyForm, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Home / Work" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Recipient name</Label>
          <Input value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder="Full name" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Phone</Label>
        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9876543210" type="tel" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Address line 1</Label>
        <Input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} placeholder="Flat / House no., Building, Street" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Address line 2 (optional)</Label>
        <Input value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} placeholder="Landmark, Area" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">State</Label>
          <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="State" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Pincode</Label>
          <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} placeholder="110001" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <input
          id="isDefault"
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => set("isDefault", e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="isDefault" className="text-xs cursor-pointer">Set as default address</Label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={() => onSave(form)}
          disabled={
            isSaving ||
            !form.recipientName.trim() ||
            !form.phone.trim() ||
            !form.addressLine1.trim() ||
            !form.city.trim() ||
            !form.pincode.trim()
          }
        >
          {isSaving ? "Saving…" : "Save address"}
        </Button>
      </div>
    </div>
  );
}

function AddressesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editAddress, setEditAddress] = useState<Address | null>(null);

  const { data: addresses = [], isLoading } = useQuery<Address[]>({
    queryKey: ["/api/addresses"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/addresses"] });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message);
      }),
    onSuccess: () => { invalidate(); setAddOpen(false); toast({ title: "Address saved" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof emptyForm }) =>
      fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message);
      }),
    onSuccess: () => { invalidate(); setEditAddress(null); toast({ title: "Address updated" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/addresses/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message);
      }),
    onSuccess: () => { invalidate(); toast({ title: "Address removed" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/addresses/${id}/default`, { method: "PATCH", credentials: "include" }),
    onSuccess: () => { invalidate(); toast({ title: "Default address updated" }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Saved Addresses
        </h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Add address
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add new address</DialogTitle>
            </DialogHeader>
            <AddressForm
              initial={emptyForm}
              onSave={(data) => createMutation.mutate(data)}
              onClose={() => setAddOpen(false)}
              isSaving={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : addresses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No saved addresses</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Add an address to speed up checkout</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((addr) => (
            <Card key={addr.id} className={`relative ${addr.isDefault ? "ring-2 ring-primary/40" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{addr.label}</Badge>
                    {addr.isDefault && (
                      <Badge className="text-xs bg-primary/10 text-primary border-0">
                        <Star className="w-3 h-3 mr-1 fill-current" /> Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Edit */}
                    <Dialog
                      open={editAddress?.id === addr.id}
                      onOpenChange={(open) => !open && setEditAddress(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditAddress(addr)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit address</DialogTitle>
                        </DialogHeader>
                        {editAddress?.id === addr.id && (
                          <AddressForm
                            initial={{
                              label: editAddress.label,
                              recipientName: editAddress.recipientName,
                              phone: editAddress.phone,
                              addressLine1: editAddress.addressLine1,
                              addressLine2: editAddress.addressLine2 ?? "",
                              city: editAddress.city,
                              state: editAddress.state,
                              pincode: editAddress.pincode,
                              country: editAddress.country,
                              isDefault: editAddress.isDefault,
                            }}
                            onSave={(data) => updateMutation.mutate({ id: editAddress.id, data })}
                            onClose={() => setEditAddress(null)}
                            isSaving={updateMutation.isPending}
                          />
                        )}
                      </DialogContent>
                    </Dialog>

                    {/* Delete — disabled if only address */}
                    {addresses.length > 1 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete address?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the address. You cannot undo this.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(addr.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                <p className="text-sm font-medium">{addr.recipientName}</p>
                <p className="text-xs text-muted-foreground">{addr.phone}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {addr.addressLine1}
                  {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {addr.city}{addr.state ? `, ${addr.state}` : ""} — {addr.pincode}
                </p>

                {!addr.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-7 text-xs text-primary px-2"
                    onClick={() => defaultMutation.mutate(addr.id)}
                    disabled={defaultMutation.isPending}
                  >
                    Set as default
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

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
      <SEOHead title="My Account" description="Manage your ISHQARA account, orders, and addresses." noIndex />
      {/* Profile card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-4 sm:p-6 flex flex-wrap items-center gap-4">
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
            <AvatarFallback className="text-lg bg-primary/20 text-primary font-bold">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif font-bold truncate" data-testid="text-account-name">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-muted-foreground text-sm truncate" data-testid="text-account-email">
              {user?.email || user?.phone || "Signed in with WhatsApp"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => { window.location.href = "/api/logout"; }}
            data-testid="button-account-logout"
          >
            Log Out
          </Button>
        </CardContent>
      </Card>

      {/* Addresses */}
      <AddressesSection userId={user!.id} />

      {/* Orders */}
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
                        {order.paymentMethod === "upi" ? "Paid via UPI" : order.paymentMethod === "razorpay" ? "Paid Online (Razorpay)" : "Cash on Delivery"}
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
