import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Instagram, MessageCircle, MapPin, Clock } from "lucide-react";
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

const KEYS = [
  "social_instagram_url", "social_whatsapp_number",
  "contact_address", "contact_hours",
];

export default function SocialContactSection({ tenantId }: Props) {
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
      for (const k of KEYS) if (form[k] !== undefined) patch[k] = form[k];
      await apiRequest("PATCH", `/api/super-admin/tenants/${tenantId}/settings`, patch);
    },
    onSuccess: () => {
      toast({ title: "Social & contact settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "settings"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">Social &amp; Contact</h3>
        <p className="text-sm text-muted-foreground">Social media links and business contact details.</p>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium">Social Media</p>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram URL</Label>
          <Input
            value={form.social_instagram_url ?? ""}
            onChange={(e) => set("social_instagram_url", e.target.value)}
            placeholder="https://instagram.com/yourbrand"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp Number</Label>
          <Input
            value={form.social_whatsapp_number ?? ""}
            onChange={(e) => set("social_whatsapp_number", e.target.value)}
            placeholder="919867902305"
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Full number with country code, no + or spaces</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-sm font-medium">Contact Information</p>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Business Address</Label>
          <Textarea
            value={form.contact_address ?? ""}
            onChange={(e) => set("contact_address", e.target.value)}
            className="text-sm min-h-[60px]"
            placeholder="Your business address"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Business Hours</Label>
          <Input
            value={form.contact_hours ?? ""}
            onChange={(e) => set("contact_hours", e.target.value)}
            className="text-sm"
            placeholder="Monday to Saturday, 10:00 am – 6:00 pm IST"
          />
        </div>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Save Social &amp; Contact
      </Button>
    </div>
  );
}
