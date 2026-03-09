import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  tenantId: number;
}

type SettingsMap = Record<string, string>;

export default function FeaturesSection({ tenantId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<SettingsMap>({
    queryKey: ["/api/super-admin/tenants", tenantId, "settings"],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [form, setForm] = useState<SettingsMap>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const toggle = (key: string) => setForm((p) => ({ ...p, [key]: p[key] === "true" ? "false" : "true" }));
  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const keys = [
        "feature_deals_enabled", "feature_bundles_enabled", "feature_reviews_enabled",
        "feature_subscribe_popup_enabled", "feature_bundle_config",
        "cod_enabled", "razorpay_enabled",
        "badge_delivery_enabled", "badge_delivery_text",
        "badge_returns_enabled", "badge_returns_text",
        "badge_authentic_enabled", "badge_authentic_text",
      ];
      const patch: SettingsMap = {};
      for (const k of keys) if (form[k] !== undefined) patch[k] = form[k];
      await apiRequest("PATCH", `/api/super-admin/tenants/${tenantId}/settings`, patch);
    },
    onSuccess: () => {
      toast({ title: "Feature settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "settings"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading settings…</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">Features</h3>
        <p className="text-sm text-muted-foreground">Toggle storefront features on or off for this tenant.</p>
      </div>

      <div className="space-y-4">
        <ToggleRow
          label="Deals Page"
          description="Show Deals & Offers page and nav link"
          checked={form.feature_deals_enabled !== "false"}
          onChange={() => toggle("feature_deals_enabled")}
        />
        <ToggleRow
          label="Bundles Page"
          description="Show Build Your Bundle page and nav link"
          checked={form.feature_bundles_enabled !== "false"}
          onChange={() => toggle("feature_bundles_enabled")}
        />
        <ToggleRow
          label="Product Reviews"
          description="Show customer reviews on product pages"
          checked={form.feature_reviews_enabled !== "false"}
          onChange={() => toggle("feature_reviews_enabled")}
        />
        <ToggleRow
          label="Subscribe Popup"
          description="Show email/WhatsApp subscribe popup to visitors"
          checked={form.feature_subscribe_popup_enabled !== "false"}
          onChange={() => toggle("feature_subscribe_popup_enabled")}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Bundle Config (JSON)</Label>
        <Input
          value={form.feature_bundle_config ?? ""}
          onChange={(e) => set("feature_bundle_config", e.target.value)}
          className="font-mono text-xs"
          placeholder='[{"count":2,"discount":10,"label":"Pick 2"}]'
        />
        <p className="text-[10px] text-muted-foreground">JSON array: count, discount %, label per tier</p>
      </div>

      <Separator />

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-sm font-medium px-0 hover:bg-transparent">
            Advanced Settings
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <ToggleRow
            label="Cash on Delivery"
            description="Enable COD payment option at checkout"
            checked={form.cod_enabled === "true"}
            onChange={() => toggle("cod_enabled")}
          />
          <ToggleRow
            label="Razorpay Payments"
            description="Show Card / Net Banking (Razorpay) option at checkout"
            checked={form.razorpay_enabled !== "false"}
            onChange={() => toggle("razorpay_enabled")}
          />

          <Separator className="my-2" />
          <p className="text-xs font-medium text-muted-foreground">Product Page Badges</p>

          <ToggleRow
            label="Free Delivery Badge"
            description="Show delivery badge on product pages"
            checked={form.badge_delivery_enabled !== "false"}
            onChange={() => toggle("badge_delivery_enabled")}
          />
          {form.badge_delivery_enabled !== "false" && (
            <div className="pl-6 space-y-1">
              <Label className="text-xs">Badge Text</Label>
              <Input value={form.badge_delivery_text ?? ""} onChange={(e) => set("badge_delivery_text", e.target.value)} className="text-sm" />
            </div>
          )}

          <ToggleRow
            label="Returns Badge"
            description="Show returns badge on product pages"
            checked={form.badge_returns_enabled !== "false"}
            onChange={() => toggle("badge_returns_enabled")}
          />
          {form.badge_returns_enabled !== "false" && (
            <div className="pl-6 space-y-1">
              <Label className="text-xs">Badge Text</Label>
              <Input value={form.badge_returns_text ?? ""} onChange={(e) => set("badge_returns_text", e.target.value)} className="text-sm" />
            </div>
          )}

          <ToggleRow
            label="Authentic Badge"
            description="Show authenticity badge on product pages"
            checked={form.badge_authentic_enabled !== "false"}
            onChange={() => toggle("badge_authentic_enabled")}
          />
          {form.badge_authentic_enabled !== "false" && (
            <div className="pl-6 space-y-1">
              <Label className="text-xs">Badge Text</Label>
              <Input value={form.badge_authentic_text ?? ""} onChange={(e) => set("badge_authentic_text", e.target.value)} className="text-sm" />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Save Feature Settings
      </Button>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
