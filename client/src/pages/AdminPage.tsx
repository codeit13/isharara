import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Package, ShoppingCart, Tag, Users, Plus, Pencil, Trash2, Eye, BarChart3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import AdminLoginPage from "@/pages/AdminLoginPage";
import type { ProductWithSizes, Order, Promotion, Subscriber } from "@shared/schema";

function DashboardStats({ products, orders }: { products: ProductWithSizes[]; orders: Order[] }) {
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const totalProducts = products.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const stats = [
    { label: "Total Revenue", value: `Rs. ${totalRevenue.toLocaleString()}`, icon: BarChart3, color: "text-green-600" },
    { label: "Orders", value: totalOrders.toString(), icon: ShoppingCart, color: "text-blue-600" },
    { label: "Products", value: totalProducts.toString(), icon: Package, color: "text-purple-600" },
    { label: "Pending Orders", value: pendingOrders.toString(), icon: Eye, color: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="p-4 rounded-md border bg-card" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
          <p className="text-lg font-bold">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function OrdersTab({ orders }: { orders: Order[] }) {
  const { toast } = useToast();
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order updated" });
    },
  });

  return (
    <div className="space-y-3" data-testid="tab-orders">
      {orders.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No orders yet</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="p-4 rounded-md border" data-testid={`order-${order.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-sm font-semibold">Order #{order.id}</p>
                <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={order.status}
                  onValueChange={(status) => updateStatusMutation.mutate({ id: order.id, status })}
                >
                  <SelectTrigger className="w-[130px] text-xs" data-testid={`select-status-${order.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{order.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment</p>
                <p className="font-medium uppercase">{order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-bold">Rs. {order.total.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{order.address}, {order.city} - {order.pincode}</p>
          </div>
        ))
      )}
    </div>
  );
}

function ProductsTab({ products }: { products: ProductWithSizes[] }) {
  const { toast } = useToast();
  const [editProduct, setEditProduct] = useState<ProductWithSizes | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted" });
    },
  });

  return (
    <div data-testid="tab-products">
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-sm font-medium">{products.length} Products</p>
        <AddProductDialog open={addOpen} onOpenChange={setAddOpen} />
      </div>
      <div className="space-y-3">
        {products.map((product) => (
          <div key={product.id} className="flex items-center gap-4 p-3 rounded-md border" data-testid={`admin-product-${product.id}`}>
            <img src={product.image} alt={product.name} className="w-14 h-16 object-cover rounded flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{product.name}</p>
                {product.isBestseller && <Badge variant="default" className="text-[10px]">Bestseller</Badge>}
                {product.isTrending && <Badge variant="secondary" className="text-[10px]">Trending</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{product.category} / {product.gender}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {product.sizes.map((s) => (
                  <span key={s.size} className="text-[10px] text-muted-foreground">
                    {s.size}: Rs.{s.price} ({s.stock} stock)
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <EditProductDialog product={product} />
              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(product.id)} data-testid={`button-delete-${product.id}`}>
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", brand: "ISHQARA", description: "", category: "Floral",
    notes: "", image: "/images/perfume-1.png", gender: "unisex",
    isBestseller: false, isTrending: false, isNewArrival: false,
    sizes: [{ size: "30ml", price: 799, originalPrice: 0, stock: 50 }],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const notesArr = form.notes.split(",").map((n) => n.trim()).filter(Boolean);
      const sizes = form.sizes.map((s) => ({
        ...s,
        originalPrice: s.originalPrice > 0 ? s.originalPrice : null,
      }));
      await apiRequest("POST", "/api/admin/products", {
        ...form,
        notes: notesArr,
        sizes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product added" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Failed to add product", variant: "destructive" }),
  });

  const updateSize = (idx: number, field: string, value: string | number) => {
    const newSizes = [...form.sizes];
    (newSizes[idx] as any)[field] = typeof value === "string" ? value : Number(value);
    setForm({ ...form, sizes: newSizes });
  };

  const addSize = () => {
    setForm({ ...form, sizes: [...form.sizes, { size: "50ml", price: 1299, originalPrice: 0, stock: 30 }] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-product">
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-product-name" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="select-product-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Floral", "Oriental", "Woody", "Fresh", "Citrus"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none" data-testid="input-product-desc" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Notes (comma-sep)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Rose, Oud, Musk" /></div>
            <div className="space-y-1"><Label className="text-xs">Image Path</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="women">Women</SelectItem>
                  <SelectItem value="men">Men</SelectItem>
                  <SelectItem value="unisex">Unisex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-5">
              <div className="flex items-center gap-2"><Switch checked={form.isBestseller} onCheckedChange={(v) => setForm({ ...form, isBestseller: v })} /><Label className="text-xs">Bestseller</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isTrending} onCheckedChange={(v) => setForm({ ...form, isTrending: v })} /><Label className="text-xs">Trending</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isNewArrival} onCheckedChange={(v) => setForm({ ...form, isNewArrival: v })} /><Label className="text-xs">New Arrival</Label></div>
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Sizes & Pricing</Label><Button size="sm" variant="outline" onClick={addSize} type="button"><Plus className="w-3 h-3 mr-1" /> Size</Button></div>
          {form.sizes.map((s, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <Input value={s.size} onChange={(e) => updateSize(i, "size", e.target.value)} placeholder="30ml" />
              <Input type="number" value={s.price} onChange={(e) => updateSize(i, "price", Number(e.target.value))} placeholder="Price" />
              <Input type="number" value={s.originalPrice} onChange={(e) => updateSize(i, "originalPrice", Number(e.target.value))} placeholder="MRP" />
              <Input type="number" value={s.stock} onChange={(e) => updateSize(i, "stock", Number(e.target.value))} placeholder="Stock" />
            </div>
          ))}

          <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.name || addMutation.isPending} data-testid="button-save-product">
            {addMutation.isPending ? "Saving..." : "Save Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditProductDialog({ product }: { product: ProductWithSizes }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand,
    description: product.description,
    category: product.category,
    notes: product.notes.join(", "),
    image: product.image,
    gender: product.gender,
    isBestseller: product.isBestseller,
    isTrending: product.isTrending,
    isNewArrival: product.isNewArrival,
    sizes: product.sizes.map((s) => ({
      id: s.id,
      size: s.size,
      price: s.price,
      originalPrice: s.originalPrice ?? 0,
      stock: s.stock,
    })),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const notesArr = form.notes.split(",").map((n) => n.trim()).filter(Boolean);
      const sizes = form.sizes.map((s) => ({
        ...s,
        originalPrice: s.originalPrice > 0 ? s.originalPrice : null,
      }));
      await apiRequest("PUT", `/api/admin/products/${product.id}`, {
        ...form,
        notes: notesArr,
        sizes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product updated" });
      setOpen(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const updateSize = (idx: number, field: string, value: string | number) => {
    const newSizes = [...form.sizes];
    (newSizes[idx] as any)[field] = typeof value === "string" ? value : Number(value);
    setForm({ ...form, sizes: newSizes });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-${product.id}`}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {product.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Floral", "Oriental", "Woody", "Fresh", "Citrus"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Notes (comma-sep)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Image Path</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2"><Switch checked={form.isBestseller} onCheckedChange={(v) => setForm({ ...form, isBestseller: v })} /><Label className="text-xs">Bestseller</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isTrending} onCheckedChange={(v) => setForm({ ...form, isTrending: v })} /><Label className="text-xs">Trending</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isNewArrival} onCheckedChange={(v) => setForm({ ...form, isNewArrival: v })} /><Label className="text-xs">New Arrival</Label></div>
          </div>
          <Separator />
          <Label className="text-xs font-semibold">Sizes & Pricing</Label>
          {form.sizes.map((s, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <Input value={s.size} onChange={(e) => updateSize(i, "size", e.target.value)} placeholder="Size" />
              <Input type="number" value={s.price} onChange={(e) => updateSize(i, "price", Number(e.target.value))} placeholder="Price" />
              <Input type="number" value={s.originalPrice} onChange={(e) => updateSize(i, "originalPrice", Number(e.target.value))} placeholder="MRP" />
              <Input type="number" value={s.stock} onChange={(e) => updateSize(i, "stock", Number(e.target.value))} placeholder="Stock" />
            </div>
          ))}
          <Button className="w-full" onClick={() => editMutation.mutate()} disabled={editMutation.isPending} data-testid="button-update-product">
            {editMutation.isPending ? "Updating..." : "Update Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromotionsTab({ promotions }: { promotions: Promotion[] }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", discountType: "percentage", discountValue: 10, code: "", isActive: true,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/promotions", {
        ...form,
        code: form.code || null,
        startDate: null,
        endDate: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "Promotion added" });
      setAddOpen(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/promotions/${id}`, { isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/promotions"] }),
  });

  return (
    <div data-testid="tab-promotions">
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-sm font-medium">{promotions.length} Promotions</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-promo"><Plus className="w-4 h-4 mr-1" /> Add Promo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Promotion</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-promo-title" /></div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="bundle">Bundle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Value</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Code (optional)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER20" /></div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.title || addMutation.isPending} data-testid="button-save-promo">
                {addMutation.isPending ? "Saving..." : "Save Promotion"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-3">
        {promotions.map((promo) => (
          <div key={promo.id} className="flex items-center justify-between gap-3 p-3 rounded-md border" data-testid={`admin-promo-${promo.id}`}>
            <div>
              <p className="text-sm font-semibold">{promo.title}</p>
              <p className="text-xs text-muted-foreground">{promo.description}</p>
              {promo.code && <Badge variant="outline" className="text-xs mt-1 font-mono">{promo.code}</Badge>}
            </div>
            <Switch
              checked={promo.isActive}
              onCheckedChange={(v) => toggleMutation.mutate({ id: promo.id, isActive: v })}
              data-testid={`switch-promo-${promo.id}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SubscribersTab({ subscribers }: { subscribers: Subscriber[] }) {
  return (
    <div data-testid="tab-subscribers">
      <p className="text-sm font-medium mb-4">{subscribers.length} Subscribers</p>
      {subscribers.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No subscribers yet</div>
      ) : (
        <div className="space-y-2">
          {subscribers.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between gap-2 p-3 rounded-md border text-sm">
              <div>
                {sub.email && <p className="font-medium">{sub.email}</p>}
                {sub.phone && <p className="text-xs text-muted-foreground">{sub.phone}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{new Date(sub.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { data: products, isLoading: prodLoading } = useQuery<ProductWithSizes[]>({ queryKey: ["/api/products"] });
  const { data: orders, isLoading: ordLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    enabled: !!user?.isAdmin,
  });
  const { data: promotions, isLoading: promoLoading } = useQuery<Promotion[]>({ queryKey: ["/api/promotions"] });
  const { data: subscribers, isLoading: subLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
    enabled: !!user?.isAdmin,
  });

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginPage />;
  }

  if (!user?.isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center" data-testid="admin-access-denied">
        <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Access denied</h1>
        <p className="text-muted-foreground text-sm mb-6">You need admin privileges to view this page.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button variant="outline">Back to store</Button>
          </Link>
          <Button variant="destructive" onClick={() => { window.location.href = "/api/logout"; }}>
            Log out
          </Button>
        </div>
      </div>
    );
  }

  const isLoading = prodLoading || ordLoading || promoLoading || subLoading;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8" data-testid="page-admin">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-6" data-testid="text-admin-title">Admin Dashboard</h1>

      <DashboardStats products={products || []} orders={orders || []} />

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="orders" data-testid="tab-trigger-orders">
            <ShoppingCart className="w-4 h-4 mr-1" /> Orders
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-trigger-products">
            <Package className="w-4 h-4 mr-1" /> Products
          </TabsTrigger>
          <TabsTrigger value="promotions" data-testid="tab-trigger-promotions">
            <Tag className="w-4 h-4 mr-1" /> Promos
          </TabsTrigger>
          <TabsTrigger value="subscribers" data-testid="tab-trigger-subscribers">
            <Users className="w-4 h-4 mr-1" /> Subscribers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <OrdersTab orders={orders || []} />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsTab products={products || []} />
        </TabsContent>
        <TabsContent value="promotions" className="mt-4">
          <PromotionsTab promotions={promotions || []} />
        </TabsContent>
        <TabsContent value="subscribers" className="mt-4">
          <SubscribersTab subscribers={subscribers || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
