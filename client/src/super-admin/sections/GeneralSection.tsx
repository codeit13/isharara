import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe, Mail, Phone, Palette, Loader2, Upload, X, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EnrichedTenant } from "../components/TenantsTable";

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
        method: "POST", body: fd, credentials: "include",
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
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-1.5">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {currentLogo ? "Change" : "Upload"}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG or WebP. Max 2MB.</p>
        </div>
      </div>
    </div>
  );
}

export default function GeneralSection({ tenant }: { tenant: EnrichedTenant }) {
  const [form, setForm] = useState({
    name: tenant.name,
    slug: tenant.slug,
    domain: tenant.domain ?? "",
    supportEmail: tenant.supportEmail ?? "",
    supportPhone: tenant.supportPhone ?? "",
    brandColor: tenant.brandColor ?? "#000000",
    isActive: tenant.isActive,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">General</h3>
        <p className="text-sm text-muted-foreground">Core identity and contact information for this tenant.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Custom Domain</Label>
        <Input
          value={form.domain}
          onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
          placeholder="store.example.com"
        />
        <p className="text-xs text-muted-foreground">Configure DNS in the Domain section after saving.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Support Email</Label>
          <Input type="email" value={form.supportEmail} onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Support Phone</Label>
          <Input value={form.supportPhone} onChange={(e) => setForm((p) => ({ ...p, supportPhone: e.target.value }))} />
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

      <div className="flex items-center justify-between">
        <div>
          <Label>Active</Label>
          <p className="text-xs text-muted-foreground">Disable to take the storefront offline</p>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={(checked) => {
            if (!checked) setConfirmOpen(true);
            else setForm((p) => ({ ...p, isActive: true }));
          }}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{tenant.name}</strong> will go offline. Customers visiting the storefront will see an unavailable page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setForm((p) => ({ ...p, isActive: false })); setConfirmOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}
