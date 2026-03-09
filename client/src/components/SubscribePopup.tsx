import { useState, useEffect } from "react";
import { X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { getTenantSlug } from "@/hooks/use-tenant";

function popupKey(): string {
  return `popup_${getTenantSlug()}`;
}

const MAX_SHOWS_PER_DAY = 2;
const DELAY_MS = 4000;

function shouldShowPopup(): boolean {
  try {
    const raw = localStorage.getItem(popupKey());
    if (!raw) return true;
    const { date, count } = JSON.parse(raw) as { date: string; count: number };
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) return true;
    return count < MAX_SHOWS_PER_DAY;
  } catch {
    return true;
  }
}

function recordShow() {
  try {
    const raw = localStorage.getItem(popupKey());
    const today = new Date().toISOString().slice(0, 10);
    let count = 1;
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; count: number };
      count = parsed.date === today ? parsed.count + 1 : 1;
    }
    localStorage.setItem(popupKey(), JSON.stringify({ date: today, count }));
  } catch {
    // ignore storage errors
  }
}

export default function SubscribePopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { subscribePopupEnabled, copySubscribeTitle, copySubscribeBody, copySubscribePromoCode, storeName } = useSettings();

  useEffect(() => {
    if (!subscribePopupEnabled) return;
    if (!shouldShowPopup()) return;
    const timer = setTimeout(() => {
      setOpen(true);
      recordShow();
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [subscribePopupEnabled]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !phone) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/subscribers", {
        email: email || null,
        phone: phone || null,
        source: "popup",
      });
      toast({ title: `Welcome to ${storeName}!`, description: `Use code ${copySubscribePromoCode} for your discount.` });
      handleClose();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 border-0" hideCloseButton aria-describedby={undefined}>
        <DialogTitle className="sr-only">Subscribe for a discount</DialogTitle>
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 sm:p-8 rounded-lg">
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 p-2.5 rounded-sm text-muted-foreground opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close"
            data-testid="button-close-popup"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-serif text-xl font-bold mb-1" data-testid="text-popup-title">
              {copySubscribeTitle}
            </h3>
            <p className="text-sm text-muted-foreground">
              {copySubscribeBody}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" data-testid="form-subscribe">
            <Input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-subscribe-email"
            />
            <Input
              type="tel"
              placeholder="WhatsApp number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="input-subscribe-phone"
            />
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-subscribe">
              {loading ? "Joining..." : "Get My Discount"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              By subscribing, you agree to receive marketing updates via email & WhatsApp
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
