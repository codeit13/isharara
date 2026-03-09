import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe, Mail, Phone, Palette, Loader2, UserPlus, Trash2,
  Crown, ShieldCheck, UserCog, ExternalLink, Search, Copy, Check, Users,
  Upload, X, ImageIcon, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ClipboardCopy, Server, ArrowRight, IndianRupee,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Tenant, User, TenantMember, TenantPayment } from "@shared/schema";
import type { EnrichedTenant } from "./TenantsTable";
type MemberWithUser = TenantMember & { user: Omit<User, "passwordHash"> };

interface Props {
  tenant: EnrichedTenant | null;
  onClose: () => void;
}

const ROLE_ICON: Record<string, typeof Crown> = { owner: Crown, admin: ShieldCheck, staff: UserCog };
const ROLE_COLOR: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  staff: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

// ─────────────────────────────────── Logo Upload ──────────────────────────────
function LogoUpload({ tenantId, currentLogo }: { tenantId: number; currentLogo: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file", description: "Use JPEG, PNG or WebP", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/logo`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Logo updated" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      await apiRequest("DELETE", `/api/super-admin/tenants/${tenantId}/logo`);
      toast({ title: "Logo removed" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant"] });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Brand Logo</Label>
      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
        {currentLogo ? (
          <div className="relative group">
            <img src={currentLogo} alt="Logo" className="h-14 w-14 rounded-lg border object-contain bg-white p-1" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="h-14 w-14 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {currentLogo ? "Change" : "Upload"}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG or WebP. Max 2MB.</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────── Deactivate Toggle ────────────────────────
function DeactivateToggle({ isActive, tenantName, onChange }: { isActive: boolean; tenantName: string; onChange: (v: boolean) => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>Active</Label>
        <p className="text-xs text-muted-foreground">Disable to take the storefront offline</p>
      </div>
      <Switch
        checked={isActive}
        onCheckedChange={(checked) => {
          if (!checked) {
            setConfirmOpen(true);
          } else {
            onChange(true);
          }
        }}
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{tenantName}</strong> will go offline. Customers visiting the storefront will see an unavailable page. You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onChange(false); setConfirmOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────── Edit Form ────────────────────────────────
function EditForm({ tenant, onSaved }: { tenant: EnrichedTenant; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    slug: tenant.slug,
    domain: tenant.domain ?? "",
    supportEmail: tenant.supportEmail ?? "",
    supportPhone: tenant.supportPhone ?? "",
    brandColor: tenant.brandColor ?? "#000000",
    isActive: tenant.isActive,
  });

  useEffect(() => {
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain ?? "",
      supportEmail: tenant.supportEmail ?? "",
      supportPhone: tenant.supportPhone ?? "",
      brandColor: tenant.brandColor ?? "#000000",
      isActive: tenant.isActive,
    });
  }, [tenant]);

  const { toast } = useToast();
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        domain: form.domain.trim() || null,
        supportEmail: form.supportEmail.trim() || null,
        supportPhone: form.supportPhone.trim() || null,
        brandColor: form.brandColor || null,
        isActive: form.isActive,
      };
      const res = await apiRequest("PATCH", `/api/super-admin/tenants/${tenant.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Tenant updated" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant"] });
      onSaved();
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Store Name</Label>
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
            className="font-mono text-sm"
          />
        </div>
      </div>

      <LogoUpload tenantId={tenant.id} currentLogo={tenant.logo} />

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Domain</Label>
        <Input
          value={form.domain}
          onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
          placeholder="store.example.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Support Email</Label>
          <Input
            type="email"
            value={form.supportEmail}
            onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Support Phone</Label>
          <Input
            value={form.supportPhone}
            onChange={(e) => setForm((p) => ({ ...p, supportPhone: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Brand Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={form.brandColor}
            onChange={(e) => setForm((p) => ({ ...p, brandColor: e.target.value }))}
            className="h-9 w-9 rounded border cursor-pointer"
          />
          <Input
            value={form.brandColor}
            onChange={(e) => setForm((p) => ({ ...p, brandColor: e.target.value }))}
            className="font-mono text-xs max-w-[120px]"
          />
          <div className="h-9 flex-1 rounded-md border" style={{ backgroundColor: form.brandColor }} />
        </div>
      </div>

      <Separator />

      <DeactivateToggle
        isActive={form.isActive}
        tenantName={tenant.name}
        onChange={(active) => setForm((p) => ({ ...p, isActive: active }))}
      />

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}

// ─────────────────────────────────── Members ──────────────────────────────────
type SearchUser = { id: string; email: string | null; phone: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null };

function UserSearchCombobox({ onSelect }: { onSelect: (user: SearchUser) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: results = [], isFetching } = useQuery<SearchUser[]>({
    queryKey: ["/api/super-admin/users/search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/super-admin/users/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const handleSearch = (value: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(value), 300);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-normal text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          Search user by email or name…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type email, name, or phone…" onValueChange={handleSearch} />
          <CommandList>
            {isFetching && <div className="px-3 py-4 text-xs text-muted-foreground text-center">Searching…</div>}
            {!isFetching && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No users found</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.id}
                    onSelect={() => { onSelect(u); setOpen(false); setQuery(""); }}
                    className="gap-2.5"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={u.profileImageUrl ?? undefined} />
                      <AvatarFallback className="text-[9px]">{(u.firstName?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email ?? u.phone}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied!" : "Copy user ID"}</TooltipContent>
    </Tooltip>
  );
}

function MembersPanel({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [newRole, setNewRole] = useState<string>("admin");

  const { data: members = [], isLoading } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/super-admin/tenants", tenantId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      await apiRequest("POST", `/api/super-admin/tenants/${tenantId}/members`, {
        userId: selectedUser.id,
        role: newRole,
      });
    },
    onSuccess: () => {
      toast({ title: "Member added", description: `${selectedUser?.email ?? "User"} was added as ${newRole}.` });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "members"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      setSelectedUser(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add member", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/super-admin/tenants/${tenantId}/members/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "members"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("POST", `/api/super-admin/tenants/${tenantId}/members`, { userId, role });
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "members"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Add Member
        </p>
        <UserSearchCombobox onSelect={setSelectedUser} />
        {selectedUser && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-background border">
            <Avatar className="h-7 w-7">
              <AvatarImage src={selectedUser.profileImageUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">{(selectedUser.firstName?.[0] ?? "?").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(" ")}</p>
              <p className="text-[10px] text-muted-foreground truncate">{selectedUser.email ?? selectedUser.phone}</p>
            </div>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-10">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No members yet</p>
          <p className="text-xs text-muted-foreground/70">Search and add users above</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.user.profileImageUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(m.user.firstName?.[0] ?? m.user.email?.[0] ?? "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">
                          {[m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || "—"}
                        </p>
                        <CopyButton text={m.userId} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{m.user.email ?? m.user.phone ?? m.userId}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={m.role}
                    onValueChange={(role) => roleChangeMutation.mutate({ userId: m.userId, role })}
                  >
                    <SelectTrigger className="h-7 w-[100px] text-[11px] border-0 bg-transparent hover:bg-muted px-2">
                      <div className="flex items-center gap-1">
                        {(() => { const I = ROLE_ICON[m.role] ?? UserCog; return <I className="h-3 w-3" />; })()}
                        <span className={ROLE_COLOR[m.role]}>{m.role}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner"><div className="flex items-center gap-1.5"><Crown className="h-3 w-3" /> Owner</div></SelectItem>
                      <SelectItem value="admin"><div className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Admin</div></SelectItem>
                      <SelectItem value="staff"><div className="flex items-center gap-1.5"><UserCog className="h-3 w-3" /> Staff</div></SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Remove member</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove member?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will revoke <strong>{m.user.email ?? m.userId}</strong>'s access to this tenant.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMutation.mutate(m.userId)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─────────────────────────────────── Billing ──────────────────────────────────
const CYCLE_LABEL: Record<string, string> = { monthly: "Monthly", yearly: "Yearly", "one-time": "One-time" };
const PAY_TYPE_LABEL: Record<string, string> = { setup: "Setup Fee", retainer: "Retainer", addon: "Add-on", refund: "Refund", custom: "Custom" };
const PAY_STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  waived: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function BillingPanel({ tenant }: { tenant: EnrichedTenant }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [billingForm, setBillingForm] = useState({
    setupFee: tenant.setupFee ?? 0,
    retainerAmount: tenant.retainerAmount ?? 0,
    billingCycle: tenant.billingCycle ?? "",
    nextDueDate: tenant.nextDueDate ? new Date(tenant.nextDueDate).toISOString().split("T")[0] : "",
  });
  const [payForm, setPayForm] = useState({
    type: "retainer" as string,
    amount: 0,
    status: "paid" as string,
    dueDate: "",
    note: "",
  });

  useEffect(() => {
    setBillingForm({
      setupFee: tenant.setupFee ?? 0,
      retainerAmount: tenant.retainerAmount ?? 0,
      billingCycle: tenant.billingCycle ?? "",
      nextDueDate: tenant.nextDueDate ? new Date(tenant.nextDueDate).toISOString().split("T")[0] : "",
    });
  }, [tenant]);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<TenantPayment[]>({
    queryKey: ["/api/super-admin/tenants", tenant.id, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/payments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const saveBillingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/super-admin/tenants/${tenant.id}/billing`, {
        setupFee: billingForm.setupFee || null,
        retainerAmount: billingForm.retainerAmount || null,
        billingCycle: billingForm.billingCycle || null,
        nextDueDate: billingForm.nextDueDate || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Billing config saved" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/super-admin/tenants/${tenant.id}/payments`, {
        type: payForm.type,
        amount: payForm.amount,
        status: payForm.status,
        dueDate: payForm.dueDate || null,
        note: payForm.note || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenant.id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      setShowAddPayment(false);
      setPayForm({ type: "retainer", amount: 0, status: "paid", dueDate: "", note: "" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      await apiRequest("PATCH", `/api/super-admin/payments/${paymentId}`, { status: "paid" });
    },
    onSuccess: () => {
      toast({ title: "Marked as paid" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenant.id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      await apiRequest("DELETE", `/api/super-admin/payments/${paymentId}`);
    },
    onSuccess: () => {
      toast({ title: "Payment deleted" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenant.id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
    },
  });

  const totalCollected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === "pending" || p.status === "overdue").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* Billing config */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-medium">Billing Configuration</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Setup Fee (₹)</Label>
            <Input
              type="number"
              value={billingForm.setupFee}
              onChange={(e) => setBillingForm((p) => ({ ...p, setupFee: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Retainer Amount (₹)</Label>
            <Input
              type="number"
              value={billingForm.retainerAmount}
              onChange={(e) => setBillingForm((p) => ({ ...p, retainerAmount: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Billing Cycle</Label>
            <Select value={billingForm.billingCycle} onValueChange={(v) => setBillingForm((p) => ({ ...p, billingCycle: v }))}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="one-time">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next Due Date</Label>
            <Input
              type="date"
              value={billingForm.nextDueDate}
              onChange={(e) => setBillingForm((p) => ({ ...p, nextDueDate: e.target.value }))}
            />
          </div>
        </div>
        <Button size="sm" onClick={() => saveBillingMutation.mutate()} disabled={saveBillingMutation.isPending} className="w-full">
          {saveBillingMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save Billing Config
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">₹{totalCollected.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Collected</p>
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
          <p className="text-lg font-bold text-amber-700 dark:text-amber-400">₹{totalPending.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-amber-600 dark:text-amber-500 uppercase tracking-wider">Pending / Overdue</p>
        </div>
      </div>

      {/* Add payment */}
      {showAddPayment ? (
        <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">Record Payment</p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={payForm.type} onValueChange={(v) => setPayForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="setup">Setup Fee</SelectItem>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Amount (₹)"
              value={payForm.amount || ""}
              onChange={(e) => setPayForm((p) => ({ ...p, amount: Number(e.target.value) }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={payForm.status} onValueChange={(v) => setPayForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={payForm.dueDate}
              onChange={(e) => setPayForm((p) => ({ ...p, dueDate: e.target.value }))}
              className="h-8 text-xs"
              placeholder="Due date"
            />
          </div>
          <Input
            placeholder="Note (optional)"
            value={payForm.note}
            onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowAddPayment(false)}>Cancel</Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => addPaymentMutation.mutate()}
              disabled={!payForm.amount || addPaymentMutation.isPending}
            >
              {addPaymentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Record"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddPayment(true)}>
          + Record Payment
        </Button>
      )}

      {/* Payment history */}
      <div>
        <h4 className="text-sm font-medium mb-2">Payment History</h4>
        {paymentsLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <IndianRupee className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">₹{p.amount.toLocaleString("en-IN")}</span>
                    <Badge variant="secondary" className={`text-[9px] px-1.5 ${PAY_STATUS_STYLE[p.status] ?? ""}`}>
                      {p.status}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5">{PAY_TYPE_LABEL[p.type] ?? p.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    {p.paidAt && <span>Paid {new Date(p.paidAt).toLocaleDateString("en-IN")}</span>}
                    {p.dueDate && !p.paidAt && <span>Due {new Date(p.dueDate).toLocaleDateString("en-IN")}</span>}
                    {p.note && <span className="truncate">• {p.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(p.status === "pending" || p.status === "overdue") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600"
                          onClick={() => markPaidMutation.mutate(p.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as paid</TooltipContent>
                    </Tooltip>
                  )}
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete payment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this ₹{p.amount.toLocaleString("en-IN")} {p.type} payment record.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePaymentMutation.mutate(p.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────── Domain / DNS ─────────────────────────────
type DnsCheck = { type: string; status: "pass" | "fail" | "warn"; detail: string };
type VerifyResult = {
  verified: boolean;
  dnsReady: boolean;
  checks: DnsCheck[];
  serverHost: string;
  instructions: { cname: { type: string; host: string; value: string; ttl: number }; note?: string };
};

function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 font-mono text-xs">
      <span className="text-muted-foreground w-14 shrink-0 text-[10px] uppercase tracking-wider">{label}</span>
      <span className="flex-1 truncate select-all">{value}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <ClipboardCopy className="h-3 w-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
};

function DomainPanel({ tenant }: { tenant: EnrichedTenant }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    setChecking(true);
    try {
      const res = await apiRequest("POST", `/api/super-admin/tenants/${tenant.id}/verify-domain`);
      const data: VerifyResult = await res.json();
      setResult(data);
      if (data.verified) {
        toast({ title: "Domain verified!", description: `${tenant.domain} is fully configured.` });
        qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      }
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  if (!tenant.domain) {
    return (
      <div className="text-center py-10">
        <Globe className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No custom domain configured</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Set a domain in the Settings tab first</p>
      </div>
    );
  }

  const serverHost = result?.serverHost ?? (typeof window !== "undefined" ? window.location.hostname : "your-server.com");

  return (
    <div className="space-y-5">
      {/* Domain status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <code className="text-sm font-medium">{tenant.domain}</code>
          {tenant.domainVerified ? (
            <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px]">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-[10px] text-amber-600">
              <AlertTriangle className="h-3 w-3" /> Unverified
            </Badge>
          )}
        </div>
      </div>

      {/* Setup instructions */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5" /> DNS Configuration
        </h4>
        <p className="text-xs text-muted-foreground">
          Add the following DNS record with your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">Recommended</Badge>
            CNAME Record
          </div>
          <div className="space-y-1.5">
            <CopyableRow label="Type" value="CNAME" />
            <CopyableRow label="Host" value={tenant.domain!} />
            <CopyableRow label="Value" value={serverHost} />
            <CopyableRow label="TTL" value="3600" />
          </div>
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Step-by-step:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
            <li>Log in to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare)</li>
            <li>Navigate to <strong>DNS Management</strong> for <code className="bg-muted px-1 rounded">{tenant.domain!.split(".").slice(-2).join(".")}</code></li>
            <li>Add a new <strong>CNAME</strong> record:
              <div className="mt-1 ml-4 space-y-0.5">
                <p>Host/Name: <code className="bg-muted px-1 rounded">{tenant.domain!.split(".")[0]}</code></p>
                <p>Points to: <code className="bg-muted px-1 rounded">{serverHost}</code></p>
              </div>
            </li>
            <li>Set TTL to <strong>3600</strong> (1 hour) or "Auto"</li>
            <li>Save and wait for DNS propagation (usually 5 min – 48 hours)</li>
            <li>Click <strong>"Verify Domain"</strong> below to check</li>
          </ol>
        </div>

        <Separator />

        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-medium">Important Notes:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>If using Cloudflare, set the proxy status to <strong>"DNS Only"</strong> (grey cloud) initially</li>
            <li>For root domains (e.g., example.com), use an <strong>A record</strong> instead of CNAME</li>
            <li>SSL certificates are provisioned automatically after DNS verification</li>
            <li>DNS propagation may take up to 48 hours in some regions</li>
          </ul>
        </div>
      </div>

      {/* Verify button */}
      <Button onClick={verify} disabled={checking} className="w-full gap-1.5">
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Verify Domain
      </Button>

      {/* Verification results */}
      {result && (
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            {result.verified ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> All Checks Passed</>
            ) : result.dnsReady ? (
              <><AlertTriangle className="h-4 w-4 text-amber-500" /> DNS Ready — Awaiting HTTPS</>
            ) : (
              <><XCircle className="h-4 w-4 text-red-500" /> Verification Failed</>
            )}
          </h4>

          <div className="space-y-2">
            {result.checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                <div className="mt-0.5 shrink-0">{STATUS_ICON[c.status]}</div>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{c.type} Record</p>
                  <p className="text-[11px] text-muted-foreground break-all">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {result.instructions.note && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-[11px] text-blue-800 dark:text-blue-300">
              {result.instructions.note}
            </div>
          )}

          {!result.verified && (
            <p className="text-[11px] text-muted-foreground text-center">
              DNS changes can take time to propagate. Try again in a few minutes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────── Main Sheet ───────────────────────────────
export default function TenantDetailSheet({ tenant, onClose }: Props) {
  if (!tenant) return null;

  return (
    <Sheet open={!!tenant} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg w-full p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader className="mb-1">
              <div className="flex items-center gap-3">
                {tenant.logo ? (
                  <img src={tenant.logo} alt={tenant.name} className="h-10 w-10 rounded-lg border object-contain bg-white p-0.5 shrink-0" />
                ) : tenant.brandColor ? (
                  <div className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0" style={{ backgroundColor: tenant.brandColor }}>
                    <span className="text-white font-bold text-sm">{tenant.name[0]}</span>
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 bg-muted">
                    <span className="font-bold text-sm text-muted-foreground">{tenant.name[0]}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <SheetTitle className="text-lg truncate">{tenant.name}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 text-xs">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{tenant.slug}</code>
                    {tenant.domain && (
                      <a
                        href={`https://${tenant.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 hover:underline"
                      >
                        {tenant.domain} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Quick stats row */}
            <div className="grid grid-cols-4 gap-2 my-5">
              {[
                { label: "Products", value: tenant.productCount },
                { label: "Orders", value: tenant.orderCount },
                { label: "Collected", value: `₹${(tenant.billingCollected ?? 0).toLocaleString("en-IN")}` },
                { label: "Pending", value: `₹${((tenant.billingPending ?? 0) + (tenant.billingOverdue ?? 0)).toLocaleString("en-IN")}` },
              ].map((s) => (
                <div key={s.label} className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            <Tabs defaultValue="settings" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
                <TabsTrigger value="members" className="flex-1">
                  Members
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{tenant.memberCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="billing" className="flex-1">
                  Billing
                </TabsTrigger>
                <TabsTrigger value="domain" className="flex-1">
                  Domain
                  {tenant.domain && (
                    tenant.domainVerified
                      ? <CheckCircle2 className="ml-1 h-3 w-3 text-emerald-500" />
                      : <AlertTriangle className="ml-1 h-3 w-3 text-amber-500" />
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="settings" className="mt-4">
                <EditForm tenant={tenant} onSaved={onClose} />
              </TabsContent>
              <TabsContent value="members" className="mt-4">
                <MembersPanel tenantId={tenant.id} />
              </TabsContent>
              <TabsContent value="billing" className="mt-4">
                <BillingPanel tenant={tenant} />
              </TabsContent>
              <TabsContent value="domain" className="mt-4">
                <DomainPanel tenant={tenant} />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
