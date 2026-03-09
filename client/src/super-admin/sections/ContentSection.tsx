import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  tenantId: number;
}

type SettingsMap = Record<string, string>;

const COPY_KEYS = [
  "copy_hero_badge", "copy_hero_title", "copy_hero_tagline", "copy_hero_description", "copy_hero_cta",
  "copy_footer_tagline",
  "copy_subscribe_title", "copy_subscribe_body", "copy_subscribe_promo_code",
  "copy_cart_empty_title", "copy_cart_empty_body",
  "copy_deals_title", "copy_deals_subtitle",
  "copy_bundle_title", "copy_bundle_subtitle",
];

export default function ContentSection({ tenantId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<SettingsMap>({
    queryKey: ["/api/super-admin/tenants", tenantId, "settings"],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [form, setForm] = useState<SettingsMap>({});
  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch: SettingsMap = {};
      for (const k of COPY_KEYS) if (form[k] !== undefined) patch[k] = form[k];
      await apiRequest("PATCH", `/api/super-admin/tenants/${tenantId}/settings`, patch);
    },
    onSuccess: () => {
      toast({ title: "Content settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "settings"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">Content &amp; Copy</h3>
        <p className="text-sm text-muted-foreground">Customize storefront text. Use <code className="bg-muted px-1 rounded text-xs">{"{store}"}</code> for the store name.</p>
      </div>

      {/* Hero Section */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Hero Section</p>
        <Field label="Badge Text" value={form.copy_hero_badge} onChange={(v) => set("copy_hero_badge", v)} />
        <Field label="Title" value={form.copy_hero_title} onChange={(v) => set("copy_hero_title", v)} />
        <Field label="Tagline" value={form.copy_hero_tagline} onChange={(v) => set("copy_hero_tagline", v)} />
        <TextareaField label="Description" value={form.copy_hero_description} onChange={(v) => set("copy_hero_description", v)} />
        <Field label="CTA Button Text" value={form.copy_hero_cta} onChange={(v) => set("copy_hero_cta", v)} />
      </div>

      <Separator />

      {/* Footer */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Footer</p>
        <TextareaField label="Footer Tagline" value={form.copy_footer_tagline} onChange={(v) => set("copy_footer_tagline", v)} />
      </div>

      <Separator />

      {/* Subscribe Popup */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Subscribe Popup</p>
        <Field label="Title" value={form.copy_subscribe_title} onChange={(v) => set("copy_subscribe_title", v)} />
        <TextareaField label="Body" value={form.copy_subscribe_body} onChange={(v) => set("copy_subscribe_body", v)} />
        <Field label="Promo Code" value={form.copy_subscribe_promo_code} onChange={(v) => set("copy_subscribe_promo_code", v)} />
      </div>

      <Separator />

      {/* Empty Cart */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Empty Cart</p>
        <Field label="Title" value={form.copy_cart_empty_title} onChange={(v) => set("copy_cart_empty_title", v)} />
        <TextareaField label="Body" value={form.copy_cart_empty_body} onChange={(v) => set("copy_cart_empty_body", v)} />
      </div>

      <Separator />

      {/* Deals Page */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Deals Page</p>
        <Field label="Title" value={form.copy_deals_title} onChange={(v) => set("copy_deals_title", v)} />
        <Field label="Subtitle" value={form.copy_deals_subtitle} onChange={(v) => set("copy_deals_subtitle", v)} />
      </div>

      <Separator />

      {/* Bundle Page */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Bundle Page</p>
        <Field label="Title" value={form.copy_bundle_title} onChange={(v) => set("copy_bundle_title", v)} />
        <Field label="Subtitle" value={form.copy_bundle_subtitle} onChange={(v) => set("copy_bundle_subtitle", v)} />
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Save Content
      </Button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="text-sm" />
    </div>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="text-sm min-h-[60px]" />
    </div>
  );
}
