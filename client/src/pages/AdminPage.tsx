import { useState, useRef, useEffect, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import {
  Package, ShoppingCart, Tag, Users, Plus, Pencil, Trash2,
  Eye, ShieldAlert, Upload, Download, FileSpreadsheet, ExternalLink,
  Check, CheckCircle2, ChevronsUpDown, Search, XCircle, AlertCircle, TrendingUp, IndianRupee, Settings,
  CreditCard, MapPin, MoreHorizontal, Package2, Phone, Receipt, TicketPercent,
} from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "wouter";
import AdminLoginPage from "@/pages/AdminLoginPage";
import type { ProductWithSizes, Order, Promotion, Subscriber, Setting } from "@shared/schema";

type AdminDashboardSummary = {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  deliveredOrders: number;
  totalProducts: number;
  activeProducts: number;
  lowStockSizes: number;
};

type AdminPaginatedProducts = {
  products: ProductWithSizes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type AdminPaginatedOrders = {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ShopFiltersResponse = {
  categories: string[];
  genders: string[];
  productTypes: string[];
};

type AdminProductsResponse = AdminPaginatedProducts | ProductWithSizes[];
type AdminOrdersResponse = AdminPaginatedOrders | Order[];

type OrderItemSummary = {
  productId?: number;
  name: string;
  image?: string;
  size: string;
  price: number;
  quantity: number;
};

function DashboardStats({ summary }: { summary: AdminDashboardSummary }) {

  const stats = [
    {
      label: "Total Revenue",
      value: `Rs. ${summary.totalRevenue.toLocaleString()}`,
      sub: `${summary.totalOrders} orders`,
      icon: IndianRupee,
      bg: "bg-green-50 dark:bg-green-950/30",
      iconColor: "text-green-600",
    },
    {
      label: "Pending",
      value: summary.pendingOrders.toString(),
      sub: "awaiting confirmation",
      icon: Eye,
      bg: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600",
    },
    {
      label: "In Progress",
      value: summary.inProgressOrders.toString(),
      sub: "confirmed / shipped",
      icon: TrendingUp,
      bg: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600",
    },
    {
      label: "Products",
      value: summary.totalProducts.toString(),
      sub: summary.lowStockSizes > 0 ? `${summary.lowStockSizes} sizes low stock` : "all stocked",
      icon: Package,
      bg: summary.lowStockSizes > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-purple-50 dark:bg-purple-950/30",
      iconColor: summary.lowStockSizes > 0 ? "text-red-500" : "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
      {stats.map((stat) => (
        <Card key={stat.label} className="border shadow-sm" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
          <CardContent className={`p-3 rounded-lg ${stat.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <div className={`p-1 rounded-md bg-background/60 ${stat.iconColor}`}>
                <stat.icon className="w-3 h-3" />
              </div>
            </div>
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.sub}</p>
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

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const normalizeAdminValue = (value: string) => value.trim().replace(/\s+/g, " ");

function isPaginatedProductsResponse(data: AdminProductsResponse | undefined): data is AdminPaginatedProducts {
  return !!data && !Array.isArray(data) && "products" in data;
}

function isPaginatedOrdersResponse(data: AdminOrdersResponse | undefined): data is AdminPaginatedOrders {
  return !!data && !Array.isArray(data) && "orders" in data;
}

function getOrderItems(order: Order): OrderItemSummary[] {
  if (!Array.isArray(order.items)) return [];
  return order.items.map((item: any) => ({
    productId: typeof item?.productId === "number" ? item.productId : undefined,
    name: typeof item?.name === "string" ? item.name : "Unnamed item",
    image: typeof item?.image === "string" ? item.image : undefined,
    size: typeof item?.size === "string" ? item.size : "—",
    price: typeof item?.price === "number" ? item.price : 0,
    quantity: typeof item?.quantity === "number" ? item.quantity : 1,
  }));
}

function formatPaymentMethod(paymentMethod: string) {
  if (paymentMethod === "upi") return "UPI";
  if (paymentMethod === "razorpay") return "Razorpay";
  if (paymentMethod === "cod") return "Cash on Delivery";
  return paymentMethod;
}

type ProductFormSize = {
  id?: number;
  size: string;
  price: number;
  originalPrice: number;
  stock: number;
};

type ProductFormState = {
  name: string;
  brand: string;
  description: string;
  categories: string[];
  notes: string;
  image: string;
  gender: string;
  productType: string;
  enabled: boolean;
  isBestseller: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  sizes: ProductFormSize[];
};

type ProductModalProps = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  productTypes: string[];
  categoryOptions: string[];
  genderOptions: string[];
  imageInputId: string;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onAddSize: () => void;
  onRemoveSize: (index: number) => void;
  onUpdateSize: (index: number, field: string, value: string | number) => void;
  onSubmit: () => void;
  submitLabel: string;
  submitPending: boolean;
  submitTestId: string;
};

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

function PaginatedFooter({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalItems);
  const paginationItems = getPaginationItems(safePage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground">
          Showing {pageStart}-{pageEnd} of {totalItems}
        </p>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Rows per page" />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {totalItems > 0 && (
        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                className={cn(safePage === 1 && "pointer-events-none opacity-50")}
                onClick={(event) => {
                  event.preventDefault();
                  if (safePage > 1) onPageChange(safePage - 1);
                }}
              />
            </PaginationItem>
            {paginationItems.map((item, index) => (
              <PaginationItem key={`${item}-${index}`}>
                {item === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href="#"
                    isActive={item === safePage}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                className={cn(safePage === totalPages && "pointer-events-none opacity-50")}
                onClick={(event) => {
                  event.preventDefault();
                  if (safePage < totalPages) onPageChange(safePage + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function OrderDetailContent({ order }: { order: Order }) {
  const items = getOrderItems(order);
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const savedAmount = order.discount > 0 ? order.discount : 0;

  const productIdsToFetch = Array.from(new Set(items.filter((i) => i.productId && !i.image).map((i) => i.productId!)));
  const productQueries = useQueries({
    queries: productIdsToFetch.map((id) => ({
      queryKey: ["/api/products", id],
      queryFn: async () => {
        const res = await fetch(`/api/products/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch product");
        return res.json();
      },
      staleTime: 60_000,
    })),
  });
  const productImageMap: Record<number, string> = {};
  productQueries.forEach((q, i) => {
    const product = q.data as { image?: string } | undefined;
    const id = productIdsToFetch[i];
    if (product?.image && id != null) productImageMap[id] = product.image;
  });

  const getItemImage = (item: OrderItemSummary) => item.image ?? (item.productId ? productImageMap[item.productId] : undefined);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Payment</p>
          <p className="mt-0.5 text-sm font-semibold">{formatPaymentMethod(order.paymentMethod)}</p>
          {order.razorpayPaymentId && (
            <p className="text-[11px] text-muted-foreground truncate">ID: {order.razorpayPaymentId}</p>
          )}
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Discount</p>
          <p className="mt-0.5 text-sm font-semibold">{savedAmount > 0 ? `Rs. ${savedAmount.toLocaleString()}` : "None"}</p>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Placed</p>
          <p className="mt-0.5 text-sm font-semibold">{new Date(order.createdAt).toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="rounded-xl border">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Package2 className="h-3.5 w-3.5 text-muted-foreground" />
            Items ({items.length})
          </p>
        </div>
        <div>
          {items.map((item, index) => {
            const imageUrl = getItemImage(item);
            return (
            <div key={`${item.name}-${item.size}-${index}`} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              {imageUrl ? (
                <img src={imageUrl} alt={item.name} className="h-11 w-9 rounded-md object-cover shrink-0" />
              ) : (
                <div className="h-11 w-9 rounded-md bg-muted/30 shrink-0 flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.productId && (
                    <a
                      href={`${window.location.origin}/product/${item.productId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{item.size} · Qty {item.quantity} · Rs. {item.price.toLocaleString()}</p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap shrink-0">Rs. {(item.price * item.quantity).toLocaleString()}</p>
            </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-xl border p-3">
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            Delivery
          </p>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.customerName}</p>
            <p className="text-xs text-muted-foreground">{order.address}</p>
            <p className="text-xs text-muted-foreground">{order.city} · {order.pincode}</p>
            <div className="flex flex-wrap gap-3 pt-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {order.phone}</span>
              <span className="inline-flex items-center gap-1"><Receipt className="h-3 w-3" /> {order.email}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            Summary
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Subtotal</span>
              <span className="text-xs">Rs. {subtotal.toLocaleString()}</span>
            </div>
            {savedAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Discount</span>
                <span className="text-xs">- Rs. {savedAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
              <span className="text-sm">Total</span>
              <span className="text-sm">Rs. {order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailPanel({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  if (!order) return null;

  const orderSubline = `${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${formatPaymentMethod(order.paymentMethod)}`;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Order Details</DrawerTitle>
            <DrawerDescription className="sr-only">Order summary and details</DrawerDescription>
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Order #{order.id}</span>
                <Badge className={cn("h-5 rounded-full px-2 text-[10px]", STATUS_META[order.status]?.className)}>
                  {STATUS_META[order.status]?.label ?? order.status}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">{orderSubline}</span>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <OrderDetailContent order={order} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle>Order Details</SheetTitle>
          <SheetDescription className="sr-only">Order summary and details</SheetDescription>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Order #{order.id}</span>
              <Badge className={cn("h-5 rounded-full px-2 text-[10px]", STATUS_META[order.status]?.className)}>
                {STATUS_META[order.status]?.label ?? order.status}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">{orderSubline}</span>
          </div>
        </SheetHeader>
        <div className="px-6 py-5">
          <OrderDetailContent order={order} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SearchableSingleSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedSearch = normalizeAdminValue(search);
  const hasExactOption = options.some((option) => option.toLowerCase() === normalizedSearch.toLowerCase());
  const canCreate = !!normalizedSearch && !hasExactOption;

  const handleSelect = (nextValue: string) => {
    onChange(normalizeAdminValue(nextValue));
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-3 text-xs font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canCreate) {
                event.preventDefault();
                handleSelect(normalizedSearch);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>{canCreate ? `Press Enter to add "${normalizedSearch}"` : emptyLabel}</CommandEmpty>
            {canCreate && (
              <CommandGroup heading="Create new">
                <CommandItem value={`create-${normalizedSearch}`} onSelect={() => handleSelect(normalizedSearch)}>
                  <Plus className="h-4 w-4" />
                  Add "{normalizedSearch}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Existing options">
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => handleSelect(option)}>
                  <Check className={cn("h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SearchableMultiSelect({
  selected,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedSearch = normalizeAdminValue(search);
  const hasExactOption = options.some((option) => option.toLowerCase() === normalizedSearch.toLowerCase());
  const isSelected = (value: string) => selected.includes(value);
  const canCreate = !!normalizedSearch && !hasExactOption && !isSelected(normalizedSearch);

  const toggleValue = (value: string) => {
    const normalizedValue = normalizeAdminValue(value);
    if (!normalizedValue) return;

    onChange(
      isSelected(normalizedValue)
        ? selected.filter((item) => item !== normalizedValue)
        : [...selected, normalizedValue]
    );
    setSearch("");
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 w-full justify-between gap-3 px-3 py-1.5 text-xs font-normal"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              {selected.length > 0 ? (
                <div className="flex min-w-0 flex-wrap gap-2">
                  {selected.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]"
                    >
                      <span className="truncate max-w-[120px]">{item}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="text-muted-foreground"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleValue(item);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleValue(item);
                          }
                        }}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="truncate text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canCreate) {
                  event.preventDefault();
                  toggleValue(normalizedSearch);
                }
              }}
            />
            <CommandList>
              <CommandEmpty>{canCreate ? `Press Enter to add "${normalizedSearch}"` : "No categories found"}</CommandEmpty>
              {canCreate && (
                <CommandGroup heading="Create new">
                  <CommandItem value={`create-${normalizedSearch}`} onSelect={() => toggleValue(normalizedSearch)}>
                    <Plus className="h-4 w-4" />
                    Add "{normalizedSearch}"
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Existing categories">
                {options.map((option) => {
                  const checked = isSelected(option);
                  return (
                    <CommandItem key={option} value={option} onSelect={() => toggleValue(option)}>
                      <Check className={cn("h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1">{option}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ProductEditorModal({
  form,
  setForm,
  productTypes,
  categoryOptions,
  genderOptions,
  imageInputId,
  onImageUpload,
  onAddSize,
  onRemoveSize,
  onUpdateSize,
  onSubmit,
  submitLabel,
  submitPending,
  submitTestId,
}: ProductModalProps) {
  return (
    <div className="space-y-3">
      {/* Hero: Image left + Description right */}
      <div className="grid grid-cols-[140px_1fr] gap-3">
        <div className="relative">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            id={imageInputId}
            onChange={onImageUpload}
          />
          <div
            className="group relative h-[175px] w-[140px] cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 transition-colors hover:border-muted-foreground/40"
            onClick={() => document.getElementById(imageInputId)?.click()}
          >
            {form.image ? (
              <img src={form.image} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <Upload className="h-5 w-5" />
                <span className="text-[11px]">Upload image</span>
              </div>
            )}
            {form.image && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                <div className="rounded-full bg-white/90 p-1.5 shadow-sm">
                  <Pencil className="h-3.5 w-3.5 text-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          className="h-[175px] resize-none text-sm"
          placeholder="Product description — scent profile, occasion, positioning..."
        />
      </div>

      {/* Core details */}
      <div className="space-y-2.5 rounded-lg border p-3">
        <p className="text-xs font-semibold text-muted-foreground">Details</p>
        <div className="grid gap-2.5 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[11px]">Product Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ex. Velvet Rose Extrait"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Brand</Label>
            <Input
              value={form.brand}
              onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
              placeholder="ISHQARA"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Gender</Label>
            <SearchableSingleSelect
              value={form.gender}
              onChange={(value) => setForm((prev) => ({ ...prev, gender: value }))}
              options={genderOptions}
              placeholder="Choose gender"
              searchPlaceholder="Search or add..."
              emptyLabel="No genders found"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Product Type</Label>
            <SearchableSingleSelect
              value={form.productType}
              onChange={(value) => setForm((prev) => ({ ...prev, productType: value }))}
              options={productTypes}
              placeholder="Choose type"
              searchPlaceholder="Search or add..."
              emptyLabel="No types found"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Categories</Label>
            <SearchableMultiSelect
              selected={form.categories}
              onChange={(values) => setForm((prev) => ({ ...prev, categories: values }))}
              options={categoryOptions}
              placeholder="Select categories"
              searchPlaceholder="Search or add..."
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[11px]">Fragrance Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Rose, Oud, Musk"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Merchandising - compact row of toggles */}
      <div className="rounded-lg border p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Visibility</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <label className="flex items-center justify-between">
            <span className="text-xs">Enabled</span>
            <Switch checked={form.enabled} onCheckedChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs">Bestseller</span>
            <Switch checked={form.isBestseller} onCheckedChange={(value) => setForm((prev) => ({ ...prev, isBestseller: value }))} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs">Trending</span>
            <Switch checked={form.isTrending} onCheckedChange={(value) => setForm((prev) => ({ ...prev, isTrending: value }))} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs">New Arrival</span>
            <Switch checked={form.isNewArrival} onCheckedChange={(value) => setForm((prev) => ({ ...prev, isNewArrival: value }))} />
          </label>
        </div>
      </div>

      {/* Sizes & Pricing */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground">Sizes & Pricing</p>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onAddSize} type="button">
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>
        <div className="space-y-1.5">
          {form.sizes.map((size, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-1.5 items-end rounded-md border bg-muted/10 p-2">
              <div>
                <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Size</Label>
                <Input
                  value={size.size}
                  onChange={(e) => onUpdateSize(index, "size", e.target.value)}
                  placeholder="50ml"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Price</Label>
                <Input
                  type="number"
                  value={size.price}
                  onChange={(e) => onUpdateSize(index, "price", Number(e.target.value))}
                  placeholder="499"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">MRP</Label>
                <Input
                  type="number"
                  value={size.originalPrice}
                  onChange={(e) => onUpdateSize(index, "originalPrice", Number(e.target.value))}
                  placeholder="599"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Stock</Label>
                <Input
                  type="number"
                  value={size.stock}
                  onChange={(e) => onUpdateSize(index, "stock", Number(e.target.value))}
                  placeholder="30"
                  className="h-8 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={form.sizes.length === 1}
                onClick={() => onRemoveSize(index)}
                className="h-8 w-8"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button className="h-9 w-full text-sm" onClick={onSubmit} disabled={!form.name || submitPending} data-testid={submitTestId}>
        {submitPending ? `${submitLabel}...` : submitLabel}
      </Button>
    </div>
  );
}

function OrdersTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data, isLoading } = useQuery<AdminPaginatedOrders>({
    queryKey: ["/api/admin/orders", page, pageSize, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-summary"] });
      toast({ title: "Order status updated" });
    },
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const orders = isPaginatedOrdersResponse(data) ? data.orders : data ?? [];
  const total = isPaginatedOrdersResponse(data) ? data.total : orders.length;
  const currentPage = isPaginatedOrdersResponse(data) ? data.page : page;
  const totalPages = isPaginatedOrdersResponse(data) ? data.totalPages : Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card data-testid="tab-orders" className="overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Orders</CardTitle>
          <span className="text-xs text-muted-foreground">{total} total</span>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, or order #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full text-sm sm:w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-1 p-4">
            {[...Array(6)].map((_, index) => <Skeleton key={index} className="h-12 rounded-lg" />)}
          </div>
        ) : total === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No orders match your filters
          </div>
        ) : (
          <div className="divide-y">
            {orders.map((order) => {
              const meta = STATUS_META[order.status] ?? STATUS_META.pending;
              const items = getOrderItems(order);
              return (
                <div
                  key={order.id}
                  className="transition-colors hover:bg-muted/5"
                  data-testid={`order-${order.id}`}
                >
                  {/* Mobile layout */}
                  <div className="space-y-2 px-4 py-3 sm:hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">#{order.id}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", meta.className)}>
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{order.customerName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {items.length} item{items.length !== 1 ? "s" : ""} · {formatPaymentMethod(order.paymentMethod)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold whitespace-nowrap">Rs. {order.total.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={order.status}
                        onValueChange={(status) => updateStatusMutation.mutate({ id: order.id, status })}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs" data-testid={`select-status-${order.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_META).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setSelectedOrder(order)}>
                        Details
                      </Button>
                    </div>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden sm:flex items-center gap-3 px-4 py-2.5">
                    <span className="text-sm font-semibold w-12 shrink-0">#{order.id}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 w-[76px] text-center", meta.className)}>
                      {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{order.customerName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {order.city} · {items.length} item{items.length !== 1 ? "s" : ""} · {formatPaymentMethod(order.paymentMethod)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap w-24 text-right shrink-0">Rs. {order.total.toLocaleString()}</p>
                    <span className="text-[11px] text-muted-foreground w-16 text-right shrink-0">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    <Select
                      value={order.status}
                      onValueChange={(status) => updateStatusMutation.mutate({ id: order.id, status })}
                    >
                      <SelectTrigger className="h-7 w-[120px] text-xs shrink-0" data-testid={`select-status-${order.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedOrder(order)}>
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PaginatedFooter
          page={currentPage}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </CardContent>

      <OrderDetailPanel
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
      />
    </Card>
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
                        <td className="px-3 py-2 text-muted-foreground">{row.productType || "—"}</td>
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

function ProductsTab({
  categoryOptions,
  genderOptions,
  productTypes,
}: {
  categoryOptions: string[];
  genderOptions: string[];
  productTypes: string[];
}) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const { data, isLoading } = useQuery<AdminProductsResponse>({
    queryKey: ["/api/admin/products", page, pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/products?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-summary"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-summary"] });
      toast({ title: "Product updated" });
    },
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  const products = isPaginatedProductsResponse(data) ? data.products : data ?? [];
  const total = isPaginatedProductsResponse(data) ? data.total : products.length;
  const currentPage = isPaginatedProductsResponse(data) ? data.page : page;
  const totalPages = isPaginatedProductsResponse(data) ? data.totalPages : Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card data-testid="tab-products" className="overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">Products</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <BulkImageUpload />
            <CsvImportDialog />
            <AddProductDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              productTypes={productTypes}
              categoryOptions={categoryOptions}
              genderOptions={genderOptions}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, categories, or tags"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{total} products</span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-1 p-3">
            {[...Array(6)].map((_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
          </div>
        ) : total === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No products match your search
          </div>
        ) : (
          <div className="divide-y">
            {products.map((product) => {
              const lowStock = product.sizes.some((s) => s.stock <= 5);
              return (
                <div
                  key={product.id}
                  className="px-4 py-2.5 transition-colors hover:bg-muted/10"
                  data-testid={`admin-product-${product.id}`}
                >
                  {/* Mobile card */}
                  <div className="flex items-center gap-3 sm:hidden">
                    <img src={product.image} alt={product.name} className="h-11 w-9 rounded-md object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold truncate">{product.name}</p>
                        {(product as ProductWithSizes & { enabled?: boolean }).enabled === false && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] opacity-70">Off</Badge>
                        )}
                        {lowStock && <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">Low</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {product.sizes.map((s) => `${s.size} ₹${s.price}`).join(" · ")}
                      </p>
                    </div>
                    <EditProductDialog
                      product={product}
                      productTypes={productTypes}
                      categoryOptions={categoryOptions}
                      genderOptions={genderOptions}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => toggleEnabledMutation.mutate({ id: product.id, enabled: (product as ProductWithSizes & { enabled?: boolean }).enabled === false })}
                          data-testid={`switch-enabled-${product.id}`}
                        >
                          {(product as ProductWithSizes & { enabled?: boolean }).enabled !== false ? (
                            <><Eye className="h-4 w-4" /> Disable</>
                          ) : (
                            <><Check className="h-4 w-4" /> Enable</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(product.id)}
                          className="text-destructive focus:text-destructive"
                          data-testid={`button-delete-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden sm:flex items-center gap-3">
                    <img src={product.image} alt={product.name} className="h-11 w-10 rounded-md object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold">{product.name}</p>
                        {(product as ProductWithSizes & { enabled?: boolean }).enabled === false && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 opacity-70">Disabled</Badge>
                        )}
                        {product.isBestseller && <Badge variant="default" className="text-[10px] h-4 px-1.5">Bestseller</Badge>}
                        {product.isTrending && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Trending</Badge>}
                        {product.isNewArrival && <Badge variant="outline" className="text-[10px] h-4 px-1.5">New</Badge>}
                        {lowStock && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Low Stock</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {product.category} · {product.gender} · {(product as any).productType || "—"}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0">
                        {product.sizes.map((s) => (
                          <span key={s.size} className={`text-[10px] ${s.stock <= 5 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                            {s.size}: ₹{s.price} · {s.stock} left
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={(product as ProductWithSizes & { enabled?: boolean }).enabled !== false}
                        onCheckedChange={(v) => toggleEnabledMutation.mutate({ id: product.id, enabled: v })}
                        data-testid={`switch-enabled-${product.id}`}
                      />
                      <EditProductDialog
                        product={product}
                        productTypes={productTypes}
                        categoryOptions={categoryOptions}
                        genderOptions={genderOptions}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteMutation.mutate(product.id)} data-testid={`button-delete-${product.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        <PaginatedFooter
          page={currentPage}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </CardContent>
    </Card>
  );
}

function AddProductDialog({
  open,
  onOpenChange,
  productTypes,
  categoryOptions,
  genderOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productTypes: string[];
  categoryOptions: string[];
  genderOptions: string[];
}) {
  const { toast } = useToast();
  const createInitialForm = (): ProductFormState => ({
    name: "",
    brand: "ISHQARA",
    description: "",
    categories: [] as string[],
    notes: "",
    image: "/images/perfume-1.png",
    gender: genderOptions[0] ?? "",
    productType: productTypes[0] ?? "",
    enabled: true,
    isBestseller: false,
    isTrending: false,
    isNewArrival: false,
    sizes: [{ size: "50ml", price: 499, originalPrice: 0, stock: 50 }],
  });
  const [form, setForm] = useState<ProductFormState>(createInitialForm());

  const addMutation = useMutation({
    mutationFn: async () => {
      const notesArr = form.notes.split(",").map((n) => n.trim()).filter(Boolean);
      const sizes = form.sizes.map((s) => ({
        ...s,
        originalPrice: s.originalPrice > 0 ? s.originalPrice : null,
      }));
      const category = form.categories.join(", ");
      await apiRequest("POST", "/api/admin/products", {
        name: form.name,
        brand: form.brand,
        description: form.description,
        category,
        notes: notesArr,
        image: form.image,
        images: [form.image],
        gender: form.gender,
        productType: form.productType,
        enabled: form.enabled,
        isBestseller: form.isBestseller,
        isTrending: form.isTrending,
        isNewArrival: form.isNewArrival,
        sizes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-summary"] });
      toast({ title: "Product added" });
      setForm(createInitialForm());
      onOpenChange(false);
    },
    onError: () => toast({ title: "Failed to add product", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      setForm(createInitialForm());
    }
  }, [open, genderOptions, productTypes]);

  const updateSize = (idx: number, field: string, value: string | number) => {
    const newSizes = [...form.sizes];
    (newSizes[idx] as any)[field] = typeof value === "string" ? value : Number(value);
    setForm({ ...form, sizes: newSizes });
  };

  const addSize = () => {
    setForm({ ...form, sizes: [...form.sizes, { size: "50ml", price: 499, originalPrice: 0, stock: 30 }] });
  };

  const updateCategories = (categories: string[]) => {
    setForm((prev) => ({ ...prev, categories }));
  };

  const removeSize = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, sizeIndex) => sizeIndex !== idx),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs" data-testid="button-add-product">
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Add Product</DialogTitle>
          <DialogDescription className="sr-only">Create a new product</DialogDescription>
        </DialogHeader>
        <ProductEditorModal
          form={form}
          setForm={setForm}
          productTypes={productTypes}
          categoryOptions={categoryOptions}
          genderOptions={genderOptions}
          imageInputId="add-product-image"
          onImageUpload={async (e) => {
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
          onAddSize={addSize}
          onRemoveSize={removeSize}
          onUpdateSize={updateSize}
          onSubmit={() => addMutation.mutate()}
          submitLabel="Save Product"
          submitPending={addMutation.isPending}
          submitTestId="button-save-product"
        />
      </DialogContent>
    </Dialog>
  );
}

function EditProductDialog({
  product,
  productTypes,
  categoryOptions,
  genderOptions,
}: {
  product: ProductWithSizes;
  productTypes: string[];
  categoryOptions: string[];
  genderOptions: string[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const createInitialForm = (): ProductFormState => ({
    name: product.name,
    brand: product.brand,
    description: product.description,
    categories: product.category
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    notes: product.notes.join(", "),
    image: product.image,
    gender: product.gender,
    productType: (product as any).productType ?? "",
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
  const [form, setForm] = useState<ProductFormState>(createInitialForm());

  const editMutation = useMutation({
    mutationFn: async () => {
      const notesArr = form.notes.split(",").map((n) => n.trim()).filter(Boolean);
      const sizes = form.sizes.map((s) => ({
        ...s,
        originalPrice: s.originalPrice > 0 ? s.originalPrice : null,
      }));
      const category = form.categories.join(", ");
      await apiRequest("PUT", `/api/admin/products/${product.id}`, {
        name: form.name,
        brand: form.brand,
        description: form.description,
        category,
        notes: notesArr,
        image: form.image,
        images: [form.image],
        gender: form.gender,
        productType: form.productType,
        enabled: form.enabled,
        isBestseller: form.isBestseller,
        isTrending: form.isTrending,
        isNewArrival: form.isNewArrival,
        sizes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-summary"] });
      toast({ title: "Product updated" });
      setOpen(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      setForm(createInitialForm());
    }
  }, [open, product]);

  const updateSize = (idx: number, field: string, value: string | number) => {
    const newSizes = [...form.sizes];
    (newSizes[idx] as any)[field] = typeof value === "string" ? value : Number(value);
    setForm({ ...form, sizes: newSizes });
  };

  const updateCategories = (categories: string[]) => {
    setForm((prev) => ({ ...prev, categories }));
  };

  const addSize = () => {
    setForm((prev) => ({
      ...prev,
      sizes: [...prev.sizes, { size: "50ml", price: 499, originalPrice: 0, stock: 30 }],
    }));
  };

  const removeSize = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, sizeIndex) => sizeIndex !== idx),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-${product.id}`}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="text-base truncate">Edit {product.name}</DialogTitle>
          <DialogDescription className="sr-only">Edit product details</DialogDescription>
        </DialogHeader>
        <ProductEditorModal
          form={form}
          setForm={setForm}
          productTypes={productTypes}
          categoryOptions={categoryOptions}
          genderOptions={genderOptions}
          imageInputId={`edit-product-image-${product.id}`}
          onImageUpload={async (e) => {
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
          onAddSize={addSize}
          onRemoveSize={removeSize}
          onUpdateSize={updateSize}
          onSubmit={() => editMutation.mutate()}
          submitLabel="Update Product"
          submitPending={editMutation.isPending}
          submitTestId="button-update-product"
        />
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
  const isTenantAdmin = user?.tenantRole === "owner" || user?.tenantRole === "admin";
  const { data: dashboardSummary, isLoading: summaryLoading } = useQuery<AdminDashboardSummary>({
    queryKey: ["/api/admin/dashboard-summary"],
    enabled: !!isTenantAdmin,
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard-summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load dashboard summary");
      return res.json();
    },
  });
  const { data: shopFilters, isLoading: filtersLoading } = useQuery<ShopFiltersResponse>({
    queryKey: ["/api/shop-filters"],
    enabled: !!isTenantAdmin,
    queryFn: async () => {
      const res = await fetch("/api/shop-filters", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load shop filters");
      return res.json();
    },
  });
  const { data: promotions, isLoading: promoLoading } = useQuery<Promotion[]>({ queryKey: ["/api/promotions"] });
  const { data: subscribers, isLoading: subLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
    enabled: !!isTenantAdmin,
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

  if (!isTenantAdmin) {
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

  const isLoading = summaryLoading || filtersLoading || promoLoading || subLoading;

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
    <div className="max-w-5xl mx-auto px-4 py-4 md:py-6" data-testid="page-admin">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg md:text-xl font-semibold" data-testid="text-admin-title">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Welcome back, {user?.firstName || "Admin"}</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="h-8 text-xs">← Store</Button>
        </Link>
      </div>

      <DashboardStats summary={dashboardSummary || {
        totalRevenue: 0,
        totalOrders: 0,
        pendingOrders: 0,
        inProgressOrders: 0,
        deliveredOrders: 0,
        totalProducts: 0,
        activeProducts: 0,
        lowStockSizes: 0,
      }} />

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="mb-0 h-9 w-full justify-start overflow-x-auto">
          <TabsTrigger value="orders" data-testid="tab-trigger-orders" className="gap-1.5 text-xs">
            <ShoppingCart className="w-3.5 h-3.5" />
            Orders
            {(dashboardSummary?.pendingOrders || 0) > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {dashboardSummary?.pendingOrders}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-trigger-products" className="gap-1.5 text-xs">
            <Package className="w-3.5 h-3.5" /> Products
          </TabsTrigger>
          <TabsTrigger value="promotions" data-testid="tab-trigger-promotions" className="gap-1.5 text-xs">
            <Tag className="w-3.5 h-3.5" /> Promos
          </TabsTrigger>
          <TabsTrigger value="subscribers" data-testid="tab-trigger-subscribers" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" /> Subscribers
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-trigger-settings" className="gap-1.5 text-xs">
            <Settings className="w-3.5 h-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-3">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="products" className="mt-3">
          <ProductsTab
            categoryOptions={shopFilters?.categories ?? []}
            genderOptions={shopFilters?.genders ?? []}
            productTypes={shopFilters?.productTypes ?? []}
          />
        </TabsContent>
        <TabsContent value="promotions" className="mt-3">
          <PromotionsTab promotions={promotions || []} />
        </TabsContent>
        <TabsContent value="subscribers" className="mt-3">
          <SubscribersTab subscribers={subscribers || []} />
        </TabsContent>
        <TabsContent value="settings" className="mt-3">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
