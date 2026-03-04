import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, CreditCard, Smartphone, CheckCircle2, X, MapPin, ExternalLink, ShoppingBag, ChevronUp, ChevronDown, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import SEOHead from "@/components/SEOHead";
import { loadRazorpay } from "@/lib/razorpay";
import {
  buildUpiUrl, buildUpiQrValue, buildAppUpiUrls, detectDevice, triggerAndroidUpi, getUpiNote,
} from "@/lib/upi";
import { QRCodeSVG } from "qrcode.react";
import type { Order, Promotion, Address } from "@shared/schema";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    shippingFee, freeShippingThreshold,
    upiId: settingsUpiId, upiBusinessName: settingsUpiName, upiMerchantMode: settingsMerchantMode, upiMerchantCode: settingsMerchantCode,
    storeName, codEnabled, minOrderAmount, razorpayEnabled,
  } = useSettings();
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [upiState, setUpiState] = useState<"idle" | "pending" | "confirmed">("idle");
  const [upiOrderId, setUpiOrderId] = useState<number | null>(null);
  const [upiAmount, setUpiAmount] = useState<number>(0);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
  });

  const { data: promotions } = useQuery<Promotion[]>({ queryKey: ["/api/promotions"] });
  const { data: addresses } = useQuery<Address[]>({
    queryKey: ["/api/addresses"],
    enabled: !!user,
    staleTime: 0,
  });

  const applyAddress = (addr: Address) => {
    setSelectedAddressId(addr.id);
    setForm((prev) => ({
      ...prev,
      customerName: addr.recipientName,
      phone: addr.phone,
      address: [addr.addressLine1, addr.addressLine2].filter(Boolean).join(", "),
      city: addr.city,
      pincode: addr.pincode,
    }));
  };

  useEffect(() => {
    if (!user) return;
    const defaultAddr = addresses?.find((a) => a.isDefault) ?? addresses?.[0];
    if (defaultAddr) {
      applyAddress(defaultAddr);
    }
    setForm((prev) => ({
      ...prev,
      email: prev.email || user.email || "",
      customerName: prev.customerName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      phone: prev.phone || user.phone || "",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, addresses]);

  useEffect(() => {
    if (!razorpayEnabled && paymentMethod === "razorpay") {
      setPaymentMethod("upi");
    }
  }, [razorpayEnabled, paymentMethod]);

  const shipping = totalPrice >= freeShippingThreshold ? 0 : shippingFee;

  const discountAmount = (() => {
    if (!appliedPromo || !appliedPromo.isActive) return 0;
    if (appliedPromo.discountType === "percentage") {
      return Math.round((totalPrice + shipping) * (appliedPromo.discountValue / 100));
    }
    if (appliedPromo.discountType === "flat") {
      return Math.min(appliedPromo.discountValue, totalPrice + shipping);
    }
    return 0;
  })();

  const grandTotal = Math.max(0, totalPrice + shipping - discountAmount);

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    const promo = promotions?.find((p) => p.isActive && p.code?.toUpperCase() === code);
    if (promo) {
      setAppliedPromo(promo);
      toast({ title: `Code "${promo.code}" applied` });
    } else {
      setAppliedPromo(null);
      toast({ title: "Invalid or expired code", variant: "destructive" });
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
  };

  const orderPayload = () => {
    const orderItems = items.map((i) => ({
      productId: i.productId,
      name: i.name,
      size: i.size,
      price: i.price,
      quantity: i.quantity,
    }));
    return {
      ...form,
      items: orderItems,
      subtotal: totalPrice,
      discount: discountAmount,
      total: grandTotal,
      paymentMethod,
    };
  };

  const handleOrderSuccess = (order: Order) => {
    setPlacedOrderId(order.id);
    clearCart();
    setOrderPlaced(true);
  };

  const openRazorpayCheckout = async (order: Order, razorpay: { orderId: string; amount: number; currency: string; keyId: string }) => {
    const Razorpay = await loadRazorpay();
    const options = {
      key: razorpay.keyId,
      amount: razorpay.amount,
      order_id: razorpay.orderId,
      name: storeName,
      description: `Order #${order.id}`,
      prefill: {
        name: form.customerName,
        email: form.email,
        contact: form.phone.replace(/\D/g, "").slice(-10),
      },
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try {
          const verifyRes = await fetch(`/api/orders/${order.id}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok) {
            toast({ title: verifyData.message || "Payment verification failed", variant: "destructive" });
            return;
          }
          handleOrderSuccess(verifyData.order);
          toast({ title: "Payment successful! Order confirmed." });
        } catch {
          toast({ title: "Payment verification failed", variant: "destructive" });
        } finally {
          setIsSubmitting(false);
        }
      },
      modal: {
        ondismiss: () => {
          setIsSubmitting(false);
          toast({ title: "Payment cancelled", variant: "destructive" });
        },
      },
    };
    const rzp = new Razorpay(options);
    rzp.open();
  };

  const handlePlaceOrder = async () => {
    if (!form.customerName || !form.email || !form.phone || !form.address || !form.city || !form.pincode) {
      toast({ title: "Please fill all delivery details", variant: "destructive" });
      return;
    }
    if (minOrderAmount > 0 && grandTotal < minOrderAmount) {
      toast({
        title: `Minimum order amount is Rs. ${minOrderAmount.toLocaleString()}`,
        description: `Add more items to proceed.`,
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(orderPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.message || "Failed to place order", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const order = data.order as Order;

      if (data.razorpay) {
        await openRazorpayCheckout(order, data.razorpay);
      } else if (paymentMethod === "upi") {
        // Snapshot the amount BEFORE clearing the cart so the UPI screen stays correct
        const finalAmount = grandTotal;
        setUpiOrderId(order.id);
        setUpiAmount(finalAmount);
        setUpiState("pending");
        setIsSubmitting(false);
        // Trigger the intent (device-specific)
        const upiUrl = buildUpiUrl({ amount: finalAmount, orderId: order.id, upiId: settingsUpiId, businessName: settingsUpiName, merchantMode: settingsMerchantMode, merchantCode: settingsMerchantCode });
        const device = detectDevice();
        if (device === "android" && upiUrl) {
          triggerAndroidUpi(upiUrl);
        }
        // iOS: buttons shown in the UI; desktop: UPI ID shown
      } else {
        handleOrderSuccess(order);
        setIsSubmitting(false);
      }
    } catch {
      toast({ title: "Failed to place order", description: "Please try again", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const isFormValid = form.customerName && form.email && form.phone && form.address && form.city && form.pincode;
  const isBelowMinOrder = minOrderAmount > 0 && grandTotal < minOrderAmount;

  // UPI pending screen — shown after order is created, waiting for user to complete payment
  if (upiState === "pending" && upiOrderId) {
    const upiId    = settingsUpiId || (import.meta.env.VITE_UPI_ID as string | undefined) || "";
    const bizName  = settingsUpiName || (import.meta.env.VITE_UPI_BUSINESS_NAME as string | undefined) || "ISHQARA";
    const mc       = settingsMerchantCode;
    const upiUrl   = buildUpiUrl({ amount: upiAmount, orderId: upiOrderId, upiId, businessName: bizName, merchantMode: settingsMerchantMode, merchantCode: mc });
    const appUrls  = buildAppUpiUrls({ amount: upiAmount, orderId: upiOrderId, upiId, businessName: bizName, merchantMode: settingsMerchantMode, merchantCode: mc });
    const device   = detectDevice();

    return (
      <div className="min-h-screen pb-28 md:pb-24">
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold mb-1">Complete your payment</h1>
          <p className="text-sm text-muted-foreground mb-2">Order #{upiOrderId} · Rs. {upiAmount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mb-6">
            Pay <strong>Rs. {upiAmount.toLocaleString()}</strong> to <strong>{bizName}</strong>
          </p>

          {/* Android: one-tap open any UPI app */}
        {device === "android" && upiUrl && (
          <a
            href={upiUrl}
            className="inline-flex items-center justify-center gap-2 w-full max-w-xs mx-auto h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium mb-3 hover:bg-primary/90"
          >
            <Smartphone className="w-4 h-4" /> Open UPI App
          </a>
        )}

        {/* iOS: per-app buttons — 2 per row */}
        {device === "ios" && (
          <div className="mb-4 max-w-sm mx-auto">
            <p className="text-xs text-muted-foreground mb-2">Choose your UPI app</p>
            <div className="grid grid-cols-2 gap-2">
              {appUrls.map((app) => (
                <a
                  key={app.label}
                  href={app.url}
                  className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted transition-colors text-sm font-medium"
                >
                  <img src={app.icon} alt={app.label} className="w-8 h-8 object-contain rounded shrink-0" />
                  <span className="truncate">{app.label}</span>
                  <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Desktop: QR code + UPI ID fallback */}
        {device === "desktop" && (
          <div className="mb-4 max-w-xs mx-auto space-y-3">
            {upiId ? (
              <>
                <p className="text-sm font-medium">Scan with any UPI app</p>
                <div className="flex justify-center">
                  <div className="p-3 rounded-xl border bg-white shadow-sm inline-block">
                    <QRCodeSVG
                      value={buildUpiQrValue({ amount: upiAmount, orderId: upiOrderId, upiId, businessName: bizName, merchantMode: settingsMerchantMode, merchantCode: mc })}
                      size={200}
                      level="M"
                      includeMargin={false}
                      imageSettings={{
                        src: "/logo.png",
                        height: 36,
                        width: 36,
                        excavate: true,
                      }}
                    />
                  </div>
                </div>
                <div className="p-3 rounded-md border bg-muted/50 text-left text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">UPI ID</span>
                    <button
                      className="font-mono font-semibold select-all hover:text-primary transition-colors"
                      onClick={() => { navigator.clipboard?.writeText(upiId); }}
                      title="Click to copy"
                    >
                      {upiId}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">Rs. {upiAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Ref</span>
                    <span className="font-mono">ISHQARA-{upiOrderId}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Open PhonePe, Google Pay, Paytm or any UPI app → Scan QR → Amount is pre-filled → Pay
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">
                UPI ID not configured. Please contact support.
              </p>
            )}
          </div>
        )}

        {/* Manual payment fallback — unified, intuitive design */}
        {upiId && (
          <div className="mb-6 max-w-sm mx-auto text-left">
            <p className="text-xs text-muted-foreground mb-3 text-center">
              Or pay manually using the details below
            </p>
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Pay to</p>
                  <p className="font-mono text-sm font-semibold truncate">{upiId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard?.writeText(upiId);
                    toast({ title: "UPI ID copied" });
                  }}
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Amount</p>
                  <p className="text-base font-bold text-primary">Rs. {upiAmount.toLocaleString()}</p>
                </div>
              </div>
              <div className="px-4 py-3 bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Add in payment description</p>
                    <p className="text-sm font-semibold break-words">{getUpiNote(upiOrderId)}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Important: Add this in your UPI app to match your payment
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground mt-1"
                    onClick={() => {
                      navigator.clipboard?.writeText(getUpiNote(upiOrderId));
                      toast({ title: "Copied" });
                    }}
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

          <p className="text-xs text-muted-foreground text-center max-w-xs mx-auto">
            Once paid, tap the button at the bottom to confirm your order.
          </p>
        </div>

        {/* Fixed bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/98 backdrop-blur-sm border-t shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => {
                clearCart();
                setUpiState("confirmed");
                setOrderPlaced(true);
                setPlacedOrderId(upiOrderId);
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> I&apos;ve completed the payment
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Haven&apos;t paid yet?{" "}
              <button
                className="text-primary underline underline-offset-2"
                onClick={() => { setUpiState("idle"); setUpiOrderId(null); }}
              >
                Go back
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center" data-testid="page-order-success">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2">Order Placed!</h1>
        {placedOrderId && (
          <p className="text-sm text-muted-foreground mb-2">Order #{placedOrderId}</p>
        )}
        <p className="text-sm text-muted-foreground mb-6">
          Thank you for your order. We&apos;ll send you a confirmation email with tracking details shortly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/account">
            <Button variant="outline" className="w-full sm:w-auto" data-testid="button-view-orders">View My Orders</Button>
          </Link>
          <Link href="/shop">
            <Button className="w-full sm:w-auto" data-testid="button-continue-shopping">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty</p>
        <Link href="/shop"><Button>Go to Shop</Button></Link>
      </div>
    );
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:py-8 pb-[env(safe-area-inset-bottom)] md:pb-0" data-testid="page-checkout">
      <SEOHead title="Checkout" description="Complete your ISHQARA order." noIndex />

      {/* Mobile: compact header */}
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <Link href="/cart">
          <Button variant="ghost" size="sm" className="-ml-2 md:ml-0" data-testid="button-back-cart">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="font-serif text-xl md:text-3xl font-bold flex-1">Checkout</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-5 md:gap-8 pb-32 md:pb-0">
        <div className="md:col-span-2 space-y-5 md:space-y-6">
          {/* Delivery Details — refined card */}
          <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </span>
                Delivery Details
              </h3>
              {user && (
                <Link href="/account">
                  <button className="text-xs text-primary font-medium hover:underline">
                    Manage
                  </button>
                </Link>
              )}
            </div>

            {/* Saved address picker — larger tap targets on mobile */}
            {user && addresses && addresses.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Saved addresses</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => { applyAddress(addr); setShowManualForm(false); }}
                      className={`text-left p-4 rounded-lg border-2 transition-all w-full min-h-[88px] ${
                        selectedAddressId === addr.id && !showManualForm
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/30 active:scale-[0.99]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] text-primary font-semibold uppercase tracking-wide">Default</span>
                        )}
                      </div>
                      <p className="font-medium text-sm leading-snug">{addr.recipientName}</p>
                      <p className="text-muted-foreground text-xs leading-snug line-clamp-2 mt-0.5">
                        {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">{addr.city} · {addr.pincode}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualForm((v) => !v)}
                  className="mt-3 w-full py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                >
                  {showManualForm ? "↑ Hide manual form" : "✎ Enter or edit address manually"}
                </button>
              </div>
            )}

            {/* Manual form */}
            {(!(user && addresses && addresses.length > 0) || showManualForm) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Full Name</Label>
                <Input value={form.customerName} onChange={handleChange("customerName")} placeholder="Your full name" className="h-11" data-testid="input-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input type="email" value={form.email} onChange={handleChange("email")} placeholder="you@example.com" className="h-11" data-testid="input-email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input type="tel" value={form.phone} onChange={handleChange("phone")} placeholder="10-digit number" className="h-11" data-testid="input-phone" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">City</Label>
                <Input value={form.city} onChange={handleChange("city")} placeholder="City" className="h-11" data-testid="input-city" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Address</Label>
                <Input value={form.address} onChange={handleChange("address")} placeholder="Street, building, landmark" className="h-11" data-testid="input-address" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pincode</Label>
                <Input value={form.pincode} onChange={handleChange("pincode")} placeholder="PIN code" className="h-11" data-testid="input-pincode" />
              </div>
            </div>
            )}
          </div>

          {/* Payment Method — refined card */}
          <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary" />
              </span>
              Payment Method
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left min-h-[72px] ${
                  paymentMethod === "upi" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 active:scale-[0.99]"
                }`}
                onClick={() => setPaymentMethod("upi")}
                data-testid="button-payment-upi"
              >
                <Smartphone className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">UPI App</p>
                  <p className="text-xs text-muted-foreground truncate">PhonePe, GPay, Paytm</p>
                </div>
              </button>
              {razorpayEnabled && (
                <button
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left min-h-[72px] ${
                    paymentMethod === "razorpay" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 active:scale-[0.99]"
                  }`}
                  onClick={() => setPaymentMethod("razorpay")}
                  data-testid="button-payment-razorpay"
                >
                  <CreditCard className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Card / Net Banking</p>
                    <p className="text-xs text-muted-foreground truncate">Razorpay</p>
                  </div>
                </button>
              )}
              {codEnabled && (
                <button
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left min-h-[72px] ${
                    paymentMethod === "cod" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 active:scale-[0.99]"
                  }`}
                  onClick={() => setPaymentMethod("cod")}
                  data-testid="button-payment-cod"
                >
                  <ShoppingBag className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground truncate">Pay on delivery</p>
                  </div>
                </button>
              )}
            </div>
            {minOrderAmount > 0 && grandTotal < minOrderAmount && (
              <p className="mt-4 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                Minimum order is Rs. {minOrderAmount.toLocaleString()}. Add Rs. {(minOrderAmount - grandTotal).toLocaleString()} more.
              </p>
            )}
          </div>
        </div>

        {/* Desktop order summary — hidden on mobile (sticky bottom bar used instead) */}
        <div className="md:col-span-1 hidden md:block">
          <div className="sticky top-20 p-5 rounded-md border bg-card">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.size}`} className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground line-clamp-1">
                    {item.name} ({item.size}) x{item.quantity}
                  </span>
                  <span className="flex-shrink-0">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <Separator className="mb-3" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>Rs. {totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? "Free" : `Rs. ${shipping}`}</span>
              </div>
              {appliedPromo && discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    Discount ({appliedPromo.code})
                    <button type="button" onClick={removePromo} className="p-0.5 rounded hover:bg-muted" aria-label="Remove code">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                  <span>- Rs. {discountAmount.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span data-testid="text-checkout-total">Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>
            {!appliedPromo && promotions && promotions.some((p) => p.isActive && p.code) && (
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={applyPromo}>
                  Apply
                </Button>
              </div>
            )}
            <Button
              className="w-full mt-4"
              disabled={!isFormValid || isSubmitting || isBelowMinOrder}
              onClick={handlePlaceOrder}
              data-testid="button-place-order"
            >
              {isSubmitting ? "Processing..." : `Place Order - Rs. ${grandTotal.toLocaleString()}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar — Place Order always visible; accordion for details + promo */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex flex-col-reverse pb-[env(safe-area-inset-bottom)]">
        <Collapsible open={orderSummaryOpen} onOpenChange={setOrderSummaryOpen}>
          <CollapsibleContent
            className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down bg-background border-t shadow-[0_-12px_40px_rgba(0,0,0,0.15),0_-4px_12px_rgba(0,0,0,0.08)]"
          >
            <div className="max-h-[65vh] overflow-y-auto overscroll-contain px-4 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Order Summary</h3>
                <span className="text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
              </div>
              {/* Line items */}
              <div className="space-y-2 mb-4">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.size}`} className="flex justify-between gap-2 text-sm">
                    <span className="text-muted-foreground line-clamp-1">
                      {item.name} ({item.size}) ×{item.quantity}
                    </span>
                    <span className="flex-shrink-0 font-medium">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <Separator className="mb-3" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rs. {totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shipping === 0 ? "Free" : `Rs. ${shipping}`}</span>
                </div>
                {appliedPromo && discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      Discount ({appliedPromo.code})
                      <button type="button" onClick={removePromo} className="p-1 rounded-md hover:bg-muted" aria-label="Remove code">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                    <span className="font-medium">- Rs. {discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span data-testid="text-checkout-total-mobile">Rs. {grandTotal.toLocaleString()}</span>
                </div>
              </div>
              {!appliedPromo && promotions && promotions.some((p) => p.isActive && p.code) && (
                <div className="flex gap-2 mt-4">
                  <Input
                    placeholder="Promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 h-10"
                    data-testid="input-promo-mobile"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={applyPromo} className="h-10" data-testid="button-apply-promo-mobile">
                    Apply
                  </Button>
                </div>
              )}
              <Button
                className="w-full mt-4 h-12 font-semibold"
                disabled={!isFormValid || isSubmitting || isBelowMinOrder}
                onClick={handlePlaceOrder}
                data-testid="button-place-order-mobile-expanded"
              >
                {isSubmitting ? "Processing..." : `Place Order · Rs. ${grandTotal.toLocaleString()}`}
              </Button>
            </div>
          </CollapsibleContent>
          {/* Single bottom bar: trigger + Place Order (only when collapsed) */}
          <div className="bg-background/98 backdrop-blur-xl border-t rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={`w-full px-4 flex items-center justify-between gap-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors ${orderSummaryOpen ? "py-3" : "py-2.5"}`}
                aria-expanded={orderSummaryOpen}
              >
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                    {shipping > 0 && ` · +Rs. ${shipping} shipping`}
                    {appliedPromo && discountAmount > 0 && ` · -Rs. ${discountAmount}`}
                  </span>
                  <span className="text-lg font-bold">Rs. {grandTotal.toLocaleString()}</span>
                </div>
                <span className="flex items-center gap-1.5 text-sm font-medium text-primary shrink-0">
                  {orderSummaryOpen ? "Hide details" : "View details"}
                  {orderSummaryOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </span>
              </button>
            </CollapsibleTrigger>
            {!orderSummaryOpen && (
              <div className="px-4 pb-4 pt-0">
                <Button
                  className="w-full h-12 font-semibold text-base"
                  disabled={!isFormValid || isSubmitting || isBelowMinOrder}
                  onClick={handlePlaceOrder}
                  data-testid="button-place-order-mobile"
                >
                  {isSubmitting ? "Processing..." : `Place Order · Rs. ${grandTotal.toLocaleString()}`}
                </Button>
              </div>
            )}
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
