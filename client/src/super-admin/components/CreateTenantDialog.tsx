import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const EMPTY = {
  name: "",
  slug: "",
  domain: "",
  supportEmail: "",
  supportPhone: "",
  brandColor: "#000000",
  adminUserId: "",
};

export default function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === slugify(prev.name) || !prev.slug ? slugify(name) : prev.slug,
    }));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Use JPEG, PNG or WebP", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
      };
      if (form.domain.trim()) payload.domain = form.domain.trim();
      if (form.supportEmail.trim()) payload.supportEmail = form.supportEmail.trim();
      if (form.supportPhone.trim()) payload.supportPhone = form.supportPhone.trim();
      if (form.brandColor && form.brandColor !== "#000000") payload.brandColor = form.brandColor;
      if (form.adminUserId.trim()) payload.adminUserId = form.adminUserId.trim();
      const res = await apiRequest("POST", "/api/super-admin/tenants", payload);
      const tenant = await res.json();

      if (logoFile && tenant.id) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await fetch(`/api/super-admin/tenants/${tenant.id}/logo`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
      }

      return tenant;
    },
    onSuccess: () => {
      toast({ title: "Tenant created", description: `${form.name} has been created successfully.` });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      setForm(EMPTY);
      clearLogo();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create tenant", description: err.message, variant: "destructive" });
    },
  });

  const isValid = form.name.trim().length > 0 && /^[a-z0-9-]+$/.test(form.slug);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(EMPTY); clearLogo(); } }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
          <DialogDescription>
            Set up a new storefront. The tenant will be created with default settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-name">Store Name *</Label>
              <Input
                id="ct-name"
                placeholder="My Perfume Store"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-slug">Slug *</Label>
              <Input
                id="ct-slug"
                placeholder="my-perfume-store"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              />
              <p className="text-[10px] text-muted-foreground">Only lowercase letters, numbers, hyphens</p>
            </div>
          </div>

          {/* Logo upload */}
          <div className="space-y-1.5">
            <Label>Brand Logo</Label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoSelect}
                className="hidden"
              />
              {logoPreview ? (
                <div className="relative group">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-16 w-16 rounded-lg border object-contain bg-white"
                  />
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {logoPreview ? "Change" : "Upload Logo"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG or WebP. Max 2MB.</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ct-domain">Custom Domain</Label>
            <Input
              id="ct-domain"
              placeholder="store.example.com"
              value={form.domain}
              onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground">You'll get DNS setup instructions after creation</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-email">Support Email</Label>
              <Input
                id="ct-email"
                type="email"
                placeholder="support@store.com"
                value={form.supportEmail}
                onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-phone">Support Phone</Label>
              <Input
                id="ct-phone"
                placeholder="+91 98765 43210"
                value={form.supportPhone}
                onChange={(e) => setForm((p) => ({ ...p, supportPhone: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-color">Brand Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="ct-color"
                  value={form.brandColor}
                  onChange={(e) => setForm((p) => ({ ...p, brandColor: e.target.value }))}
                  className="h-9 w-9 rounded border cursor-pointer"
                />
                <Input
                  value={form.brandColor}
                  onChange={(e) => setForm((p) => ({ ...p, brandColor: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-admin">Initial Admin User ID</Label>
              <Input
                id="ct-admin"
                placeholder="user-uuid (optional)"
                value={form.adminUserId}
                onChange={(e) => setForm((p) => ({ ...p, adminUserId: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Create Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
