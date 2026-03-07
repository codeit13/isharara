import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Package, ShoppingCart, Tag, Users, Plus, Pencil, Trash2,
  Eye, BarChart3, ShieldAlert, Upload, Download, FileSpreadsheet,
  CheckCircle2, XCircle, AlertCircle, TrendingUp, IndianRupee, Settings,
} from "lucide-react";
import Papa from "papaparse";
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
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import AdminLoginPage from "@/pages/AdminLoginPage";
import type { ProductWithSizes, Order, Promotion, Subscriber, Setting } from "@shared/schema";

function DashboardStats({ products, orders }: { products: ProductWithSizes[]; orders: Order[] }) {
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const confirmedOrders = orders.filter((o) => o.status === "confirmed" || o.status === "shipped").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const lowStock = products.reduce((count, p) => count + p.sizes.filter((s) => s.stock <= 5).length, 0);

  const stats = [
    {
      label: "Total Revenue",
      value: `Rs. ${totalRevenue.toLocaleString()}`,
      sub: `${orders.length} orders`,
      icon: IndianRupee,
      bg: "bg-green-50 dark:bg-green-950/30",
      iconColor: "text-green-600",
    },
    {
      label: "Pending",
      value: pendingOrders.toString(),
      sub: "awaiting confirmation",
      icon: Eye,
      bg: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600",
    },
    {
      label: "In Progress",
      value: confirmedOrders.toString(),
      sub: "confirmed / shipped",
      icon: TrendingUp,
      bg: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600",
    },
    {
      label: "Products",
      value: products.length.toString(),
      sub: lowStock > 0 ? `${lowStock} sizes low stock` : "all stocked",
      icon: Package,
      bg: lowStock > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-purple-50 dark:bg-purple-950/30",
      iconColor: lowStock > 0 ? "text-red-500" : "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="border shadow-sm" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
          <CardContent className={`p-4 rounded-lg ${stat.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <div className={`p-1.5 rounded-md bg-background/60 ${stat.iconColor}`}>
                <stat.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  shipped:   { label: "Shipped",   className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

function OrdersTab({ orders }: { orders: Order[] }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order status updated" });
    },
  });

  const filtered = orders
    .filter((o) => statusFilter === "all" || o.status === statusFilter)
    .filter((o) =>
      !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.phone.includes(search) ||
      String(o.id).includes(search)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div data-testid="tab-orders">
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Search by name, phone or order #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground self-center sm:whitespace-nowrap">
          {filtered.length} / {orders.length} orders
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {orders.length === 0 ? "No orders yet" : "No orders match your filters"}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const meta = STATUS_META[order.status] ?? STATUS_META.pending;
            return (
              <div key={order.id} className="rounded-lg border bg-card overflow-hidden" data-testid={`order-${order.id}`}>
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">#{order.id}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.className}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">Rs. {order.total.toLocaleString()}</span>
                    <Select
                      value={order.status}
                      onValueChange={(status) => updateStatusMutation.mutate({ id: order.id, status })}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs" data-testid={`select-status-${order.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Customer</p>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-muted-foreground">{order.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Email</p>
                    <p className="font-medium break-all">{order.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Delivery</p>
                    <p className="font-medium">{order.city} – {order.pincode}</p>
                    <p className="text-muted-foreground truncate">{order.address}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Payment</p>
                    <p className="font-medium uppercase">{order.paymentMethod}</p>
                    <p className="text-muted-foreground">{order.discount > 0 ? `Disc: Rs. ${order.discount}` : ""}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type CsvRow = Record<string, string>;

interface ImportResult {
  name: string;
  success: boolean;
  error?: string;
}

function BulkImageUpload() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  return (
    <>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        id="bulk-image-upload"
        onChange={async (e) => {
          const files = e.target.files;
          if (!files?.length) return;
          setUploading(true);
          try {
            const fd = new FormData();
            for (let i = 0; i < files.length; i++) fd.append("images", files[i]);
            const res = await fetch("/api/admin/bulk-upload-images", { method: "POST", body: fd, credentials: "include" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message ?? "Upload failed");
            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
            const { updated, unmatched } = data;
            if (updated?.length) toast({ title: `${updated.length} product(s) updated` });
            if (unmatched?.length) toast({ title: `${unmatched.length} unmatched: ${unmatched.slice(0, 3).join(", ")}${unmatched.length > 3 ? "…" : ""}`, variant: "destructive" });
          } catch (err: any) {
            toast({ title: err.message ?? "Upload failed", variant: "destructive" });
          } finally {
            setUploading(false);
            e.target.value = "";
          }
        }}
      />
      <Button size="sm" variant="outline" onClick={() => document.getElementById("bulk-image-upload")?.click()} disabled={uploading} data-testid="button-bulk-upload-images" title="Image filename must match product name (e.g. Velvet Rose.jpg)">
        <Upload className="w-4 h-4 mr-1.5" /> {uploading ? "Uploading…" : "Bulk upload images"}
      </Button>
    </>
  );
}

function CsvImportDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    window.location.href = "/api/admin/products/csv-template";
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResults(null);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setParsed(result.data);
      },
      error: () => toast({ title: "Failed to parse CSV", variant: "destructive" }),
    });
  };

  const handleImport = async () => {
    if (!parsed.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/products/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResults(data.results);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
      toast({ title: `Imported ${data.imported} product${data.imported !== 1 ? "s" : ""}${data.failed ? `, ${data.failed} failed` : ""}` });
    } catch (e: any) {
      toast({ title: e.message || "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setParsed([]);
    setFileName("");
    setResults(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const REQUIRED_COLS = ["name", "sizes"];
  const missingCols = parsed.length > 0
    ? REQUIRED_COLS.filter((c) => !Object.keys(parsed[0]).includes(c))
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-csv-import">
          <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Bulk Import Products via CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 — Download template */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold mb-0.5">Step 1 — Download the template</p>
                <p className="text-xs text-muted-foreground">
                  Fill it in and upload. Sizes format: <code className="bg-muted px-1 rounded text-[11px]">50ml:499:599:30|100ml:799:999:20</code>
                  <span className="block mt-0.5 opacity-70">size:price:mrp:stock, multiple sizes separated by |</span>
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={downloadTemplate} className="flex-shrink-0">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Template
              </Button>
            </div>
          </div>

          {/* Step 2 — Upload file */}
          <div>
            <p className="text-sm font-semibold mb-2">Step 2 — Upload your CSV</p>
            <label
              className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {fileName ? (
                  <span className="text-foreground font-medium">{fileName}</span>
                ) : (
                  "Drop a CSV file here, or click to browse"
                )}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          </div>

          {/* Validation warning */}
          {missingCols.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Missing required columns: <strong>{missingCols.join(", ")}</strong>
            </div>
          )}

          {/* Preview table */}
          {parsed.length > 0 && missingCols.length === 0 && !results && (
            <div>
              <p className="text-sm font-semibold mb-2">Preview — {parsed.length} row{parsed.length !== 1 ? "s" : ""}</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      {["name", "category", "gender", "productType", "sizes"].map((col) => (
                        <th key={col} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.gender || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.productType || "og"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{row.sizes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2">…and {parsed.length - 10} more rows</p>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div>
              <p className="text-sm font-semibold mb-2">Import Results</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-md text-xs ${r.success ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                    {r.success
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    }
                    <span className="font-medium">{r.name}</span>
                    {r.error && <span className="text-muted-foreground ml-auto">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {results ? (
              <Button className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  className="flex-1"
                  disabled={!parsed.length || missingCols.length > 0 || importing}
                  onClick={handleImport}
                >
                  {importing ? "Importing…" : `Import ${parsed.length} Product${parsed.length !== 1 ? "s" : ""}`}
                </Button>
                {parsed.length > 0 && (
                  <Button variant="outline" onClick={reset}>Clear</Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductsTab({ products }: { products: ProductWithSizes[] }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
      toast({ title: "Product deleted" });
    },
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/admin/products/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
      toast({ title: "Product updated" });
    },
  });

  const filtered = products.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="tab-products">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm"
        />
        <p className="text-xs text-muted-foreground self-center sm:whitespace-nowrap">
          {filtered.length} / {products.length}
        </p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <BulkImageUpload />
            <CsvImportDialog />
            <AddProductDialog open={addOpen} onOpenChange={setAddOpen} />
          </div>
          <p className="text-[10px] text-muted-foreground">Bulk upload: filename must match product name (e.g. Velvet Rose.jpg)</p>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {products.length === 0 ? "No products yet" : "No products match your search"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => {
            const lowStock = product.sizes.some((s) => s.stock <= 5);
            return (
              <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors" data-testid={`admin-product-${product.id}`}>
                <img src={product.image} alt={product.name} className="w-12 h-14 object-cover rounded-md flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold">{product.name}</p>
                    {(product as ProductWithSizes & { enabled?: boolean }).enabled === false && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 opacity-70">Disabled</Badge>
                    )}
                    {product.isBestseller && <Badge variant="default" className="text-[10px] h-4 px-1.5">BS</Badge>}
                    {product.isTrending && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">TR</Badge>}
                    {product.isNewArrival && <Badge variant="outline" className="text-[10px] h-4 px-1.5">NEW</Badge>}
                    {lowStock && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Low Stock</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{product.category} · {product.gender} · {(product as any).productType === "recreation" ? "Recreation" : "The Ishqara Collection"}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {product.sizes.map((s) => (
                      <span key={s.size} className={`text-[10px] ${s.stock <= 5 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                        {s.size}: ₹{s.price} · {s.stock} left
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Switch
                    checked={(product as ProductWithSizes & { enabled?: boolean }).enabled !== false}
                    onCheckedChange={(v) => toggleEnabledMutation.mutate({ id: product.id, enabled: v })}
                    data-testid={`switch-enabled-${product.id}`}
                  />
                  <EditProductDialog product={product} />
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(product.id)} data-testid={`button-delete-${product.id}`}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", brand: "ISHQARA", description: "", category: "Floral",
    notes: "", image: "/images/perfume-1.png", gender: "unisex",
    productType: "og",
    enabled: true,
    isBestseller: false, isTrending: false, isNewArrival: false,
    sizes: [{ size: "50ml", price: 499, originalPrice: 0, stock: 50 }],
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
        image: form.image,
        images: [form.image],
        notes: notesArr,
        sizes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
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
    setForm({ ...form, sizes: [...form.sizes, { size: "50ml", price: 499, originalPrice: 0, stock: 30 }] });
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
              <Label className="text-xs">Category (comma-separated)</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Floral, Oriental, Woody"
                data-testid="input-product-category"
              />
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none" data-testid="input-product-desc" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Notes (comma-sep)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Rose, Oud, Musk" /></div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Product Image</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  id="add-product-image"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fd = new FormData();
                      fd.append("image", file);
                      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd, credentials: "include" });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.message ?? "Upload failed");
                      }
                      const { url } = await res.json();
                      setForm((f) => ({ ...f, image: url }));
                      toast({ title: "Image uploaded" });
                    } catch (err: any) {
                      toast({ title: err.message ?? "Upload failed", variant: "destructive" });
                    }
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("add-product-image")?.click()}>
                  <Upload className="w-3 h-3 mr-1" /> Upload
                </Button>
                <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="/images/... or path" className="flex-1" />
              </div>
              {form.image && <img src={form.image} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded border" />}
            </div>
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
            <div className="space-y-1">
              <Label className="text-xs">Product Type</Label>
              <Select value={form.productType} onValueChange={(v) => setForm({ ...form, productType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="og">The Ishqara Collection</SelectItem>
                  <SelectItem value="recreation">Recreation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2"><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /><Label className="text-xs">Enabled</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isBestseller} onCheckedChange={(v) => setForm({ ...form, isBestseller: v })} /><Label className="text-xs">Bestseller</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isTrending} onCheckedChange={(v) => setForm({ ...form, isTrending: v })} /><Label className="text-xs">Trending</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isNewArrival} onCheckedChange={(v) => setForm({ ...form, isNewArrival: v })} /><Label className="text-xs">New Arrival</Label></div>
          </div>

          <Separator />
          <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Sizes & Pricing</Label><Button size="sm" variant="outline" onClick={addSize} type="button"><Plus className="w-3 h-3 mr-1" /> Size</Button></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Size</span>
            <span>Price (₹)</span>
            <span>MRP (₹)</span>
            <span>Stock</span>
          </div>
          {form.sizes.map((s, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input value={s.size} onChange={(e) => updateSize(i, "size", e.target.value)} placeholder="50ml" />
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
    productType: (product as any).productType ?? "og",
    enabled: (product as ProductWithSizes & { enabled?: boolean }).enabled !== false,
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
        image: form.image,
        images: [form.image],
        notes: notesArr,
        sizes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
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
              <Label className="text-xs">Category (comma-separated)</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Floral, Oriental, Woody"
              />
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Notes (comma-sep)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Product Image</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  id={`edit-product-image-${product.id}`}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fd = new FormData();
                      fd.append("image", file);
                      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd, credentials: "include" });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.message ?? "Upload failed");
                      }
                      const { url } = await res.json();
                      setForm((f) => ({ ...f, image: url }));
                      toast({ title: "Image uploaded" });
                    } catch (err: any) {
                      toast({ title: err.message ?? "Upload failed", variant: "destructive" });
                    }
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`edit-product-image-${product.id}`)?.click()}>
                  <Upload className="w-3 h-3 mr-1" /> Upload
                </Button>
                <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="/images/... or path" className="flex-1" />
              </div>
              {form.image && <img src={form.image} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded border" />}
            </div>
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
            <div className="space-y-1">
              <Label className="text-xs">Product Type</Label>
              <Select value={form.productType} onValueChange={(v) => setForm({ ...form, productType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="og">The Ishqara Collection</SelectItem>
                  <SelectItem value="recreation">Recreation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2"><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /><Label className="text-xs">Enabled</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isBestseller} onCheckedChange={(v) => setForm({ ...form, isBestseller: v })} /><Label className="text-xs">Bestseller</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isTrending} onCheckedChange={(v) => setForm({ ...form, isTrending: v })} /><Label className="text-xs">Trending</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isNewArrival} onCheckedChange={(v) => setForm({ ...form, isNewArrival: v })} /><Label className="text-xs">New Arrival</Label></div>
          </div>
          <Separator />
          <Label className="text-xs font-semibold">Sizes & Pricing</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Size</span>
            <span>Price (₹)</span>
            <span>MRP (₹)</span>
            <span>Stock</span>
          </div>
          {form.sizes.map((s, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
    firstOrderOnly: false, startDate: "", endDate: "",
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/promotions", {
        ...form,
        code: form.code || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "Promotion added" });
      setAddOpen(false);
      setForm({ title: "", description: "", discountType: "percentage", discountValue: 10, code: "", isActive: true, firstOrderOnly: false, startDate: "", endDate: "" });
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
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setForm({ title: "", description: "", discountType: "percentage", discountValue: 10, code: "", isActive: true, firstOrderOnly: false, startDate: "", endDate: "" }); }}>
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
                  <Label className="text-xs">Discount Type</Label>
                  <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v, discountValue: v === "bundle" ? 0 : form.discountValue })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage off</SelectItem>
                      <SelectItem value="flat">Flat amount off (₹)</SelectItem>
                      <SelectItem value="bundle">Buy 2 Get 1 Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.discountType === "percentage" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Percent off (%)</Label>
                    <Input type="number" min={1} max={100} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })} placeholder="e.g. 10" />
                    <p className="text-[10px] text-muted-foreground">e.g. 10 for 10% off order</p>
                  </div>
                )}
                {form.discountType === "flat" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Amount off (₹)</Label>
                    <Input type="number" min={0} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })} placeholder="e.g. 200" />
                    <p className="text-[10px] text-muted-foreground">e.g. 200 for Rs. 200 off</p>
                  </div>
                )}
                {form.discountType === "bundle" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">Not used</div>
                    <p className="text-[10px] text-muted-foreground">Cheapest item free per 3 items in cart</p>
                  </div>
                )}
              </div>
              <div className="space-y-1"><Label className="text-xs">Code (optional)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="B2G1, SUMMER20" /></div>
              <div className="flex items-center gap-2"><Switch checked={form.firstOrderOnly} onCheckedChange={(v) => setForm({ ...form, firstOrderOnly: v })} /><Label className="text-xs">First order only</Label></div>
              <p className="text-[10px] text-muted-foreground -mt-2">When enabled, this code applies only to customers who have never placed an order before.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /><p className="text-[10px] text-muted-foreground">Optional — when promo becomes valid</p></div>
                <div className="space-y-1"><Label className="text-xs">End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /><p className="text-[10px] text-muted-foreground">Optional — when promo expires</p></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /><Label className="text-xs">Active</Label></div>
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
              <div className="flex flex-wrap gap-1 mt-1">
                {promo.code && <Badge variant="outline" className="text-xs font-mono">{promo.code}</Badge>}
                <span className="text-[10px] text-muted-foreground">{promo.discountType} · {promo.discountValue}{promo.discountType === "percentage" ? "%" : ""}</span>
                {(promo as Promotion & { firstOrderOnly?: boolean }).firstOrderOnly && <Badge variant="secondary" className="text-[10px]">First order</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <EditPromoDialog promo={promo} />
              <Switch
                checked={promo.isActive}
                onCheckedChange={(v) => toggleMutation.mutate({ id: promo.id, isActive: v })}
                data-testid={`switch-promo-${promo.id}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditPromoDialog({ promo }: { promo: Promotion }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: promo.title,
    description: promo.description,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    code: promo.code || "",
    isActive: promo.isActive,
    firstOrderOnly: (promo as Promotion & { firstOrderOnly?: boolean }).firstOrderOnly ?? false,
    startDate: promo.startDate ? new Date(promo.startDate).toISOString().slice(0, 10) : "",
    endDate: promo.endDate ? new Date(promo.endDate).toISOString().slice(0, 10) : "",
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/promotions/${promo.id}`, {
        title: form.title,
        description: form.description,
        discountType: form.discountType,
        discountValue: form.discountValue,
        code: form.code || null,
        isActive: form.isActive,
        firstOrderOnly: form.firstOrderOnly,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "Promotion updated" });
      setOpen(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({
      title: promo.title,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      code: promo.code || "",
      isActive: promo.isActive,
      firstOrderOnly: (promo as Promotion & { firstOrderOnly?: boolean }).firstOrderOnly ?? false,
      startDate: promo.startDate ? new Date(promo.startDate).toISOString().slice(0, 10) : "",
      endDate: promo.endDate ? new Date(promo.endDate).toISOString().slice(0, 10) : "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-promo-${promo.id}`}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Promotion</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Discount Type</Label>
              <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v, discountValue: v === "bundle" ? 0 : form.discountValue })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage off</SelectItem>
                  <SelectItem value="flat">Flat amount off (₹)</SelectItem>
                  <SelectItem value="bundle">Buy 2 Get 1 Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.discountType === "percentage" && (
              <div className="space-y-1">
                <Label className="text-xs">Percent off (%)</Label>
                <Input type="number" min={1} max={100} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })} />
              </div>
            )}
            {form.discountType === "flat" && (
              <div className="space-y-1">
                <Label className="text-xs">Amount off (₹)</Label>
                <Input type="number" min={0} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })} />
              </div>
            )}
            {form.discountType === "bundle" && (
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">Not used</div>
              </div>
            )}
          </div>
          <div className="space-y-1"><Label className="text-xs">Code (optional)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="B2G1" /></div>
          <div className="flex items-center gap-2"><Switch checked={form.firstOrderOnly} onCheckedChange={(v) => setForm({ ...form, firstOrderOnly: v })} /><Label className="text-xs">First order only</Label></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /><p className="text-[10px] text-muted-foreground">Leave empty for no start</p></div>
            <div className="space-y-1"><Label className="text-xs">End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /><p className="text-[10px] text-muted-foreground">Leave empty for no expiry</p></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /><Label className="text-xs">Active</Label></div>
          <Button className="w-full" onClick={() => editMutation.mutate()} disabled={!form.title || editMutation.isPending} data-testid="button-update-promo">
            {editMutation.isPending ? "Updating..." : "Update Promotion"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubscribersTab({ subscribers }: { subscribers: Subscriber[] }) {
  const exportCsv = () => {
    const rows = [
      ["email", "phone", "source", "joined"],
      ...subscribers.map((s) => [
        s.email || "",
        s.phone || "",
        (s as any).source || "popup",
        new Date(s.createdAt).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ishqara-subscribers.csv";
    a.click();
  };

  return (
    <div data-testid="tab-subscribers">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">{subscribers.length} Subscribers</p>
        {subscribers.length > 0 && (
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        )}
      </div>
      {subscribers.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">No subscribers yet</div>
      ) : (
        <div className="space-y-2">
          {subscribers.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card text-sm">
              <div>
                {sub.email && <p className="font-medium">{sub.email}</p>}
                {sub.phone && <p className="text-xs text-muted-foreground">{sub.phone}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{new Date(sub.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();
  const { data: rows, isLoading } = useQuery<Setting[]>({
    queryKey: ["/api/admin/settings"],
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rows) {
      const initial: Record<string, string> = {};
      for (const r of rows) initial[r.key] = r.value;
      setDraft(initial);
    }
  }, [rows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: e.message || "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
      </div>
    );
  }

  const settingsByGroup: { group: string; keys: string[] }[] = [
    { group: "Shipping",        keys: ["shipping_fee", "free_shipping_threshold", "min_order_amount"] },
    { group: "Store Info",      keys: ["store_name", "store_email", "store_phone"] },
    { group: "UPI Payments",    keys: ["upi_business_name", "upi_merchant_mode", "upi_id", "upi_merchant_code"] },
    { group: "Feature Flags",   keys: ["cod_enabled", "razorpay_enabled"] },
    { group: "Product Page Badges", keys: ["badge_delivery_enabled", "badge_delivery_text", "badge_returns_enabled", "badge_returns_text", "badge_authentic_enabled", "badge_authentic_text"] },
  ];

  const rowByKey = Object.fromEntries((rows || []).map((r) => [r.key, r]));

  return (
    <div className="pb-24">
      <div className="space-y-4 max-w-2xl">
        {settingsByGroup.map(({ group, keys }) => (
          <div key={group} className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b bg-muted/40 rounded-t-xl">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group}</h3>
            </div>
            <div className="divide-y">
              {keys.map((key) => {
                const meta = rowByKey[key];
                if (!meta) return null;
                const val = draft[key] ?? "";
                return (
                  <div key={key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <Label className="text-sm font-medium">{meta.label}</Label>
                      {meta.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                      )}
                    </div>
                    <div className="w-full sm:w-48 shrink-0">
                      {meta.type === "boolean" ? (
                        <div className="flex items-center gap-2 sm:pt-1">
                          <Switch
                            checked={val === "true"}
                            onCheckedChange={(v) => setDraft((d) => ({ ...d, [key]: v ? "true" : "false" }))}
                          />
                          <span className="text-xs text-muted-foreground">
                            {key === "upi_merchant_mode"
                              ? (val === "true" ? "Merchant UPI ID" : "Personal UPI ID")
                              : (val === "true" ? "Enabled" : "Disabled")}
                          </span>
                        </div>
                      ) : (
                        <Input
                          value={val}
                          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                          type={meta.type === "number" ? "number" : "text"}
                          className="text-sm h-9"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating save bar — always visible at the bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Changes are saved globally and take effect immediately.
          </p>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto min-w-[140px]">
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { data: products, isLoading: prodLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/admin/products"],
    enabled: !!user?.isAdmin,
  });
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Welcome back, {user?.firstName || "Admin"}</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">← Store</Button>
        </Link>
      </div>

      <DashboardStats products={products || []} orders={orders || []} />

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto mb-1">
          <TabsTrigger value="orders" data-testid="tab-trigger-orders" className="gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" />
            Orders
            {(orders || []).filter((o) => o.status === "pending").length > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {(orders || []).filter((o) => o.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-trigger-products" className="gap-1.5">
            <Package className="w-3.5 h-3.5" /> Products
          </TabsTrigger>
          <TabsTrigger value="promotions" data-testid="tab-trigger-promotions" className="gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Promos
          </TabsTrigger>
          <TabsTrigger value="subscribers" data-testid="tab-trigger-subscribers" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Subscribers
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-trigger-settings" className="gap-1.5">
            <Settings className="w-3.5 h-3.5" /> Settings
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
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
