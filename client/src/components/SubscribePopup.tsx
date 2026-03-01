import { useState, useEffect } from "react";
import { X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SubscribePopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const dismissed = sessionStorage.getItem("ishqara_popup_dismissed");
    if (!dismissed) {
      const timer = setTimeout(() => setOpen(true), 3001);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    sessionStorage.setItem("ishqara_popup_dismissed", "true");
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
      toast({ title: "Welcome to ISHQARA!", description: "Use code FIRST10 for 10% off your first order." });
      handleClose();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 border-0">
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 sm:p-8 rounded-lg">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 text-muted-foreground"
            data-testid="button-close-popup"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-serif text-xl font-bold mb-1" data-testid="text-popup-title">
              Get 10% Off
            </h3>
            <p className="text-sm text-muted-foreground">
              Join the ISHQARA family and get an exclusive discount on your first order
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
