import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, CreditCard, Smartphone, CheckCircle2, X, MapPin, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { loadRazorpay } from "@/lib/razorpay";
import {
  buildUpiUrl, buildUpiQrValue, buildAppUpiUrls, detectDevice, triggerAndroidUpi,
} from "@/lib/upi";
import { QRCodeSVG } from "qrcode.react";
import type { Order, Promotion, Address } from "@shared/schema";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
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

  const shipping = totalPrice >= 1499 ? 0 : 99;

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
      name: "ISHQARA",
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
        const upiUrl = buildUpiUrl({ amount: finalAmount, orderId: order.id });
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

  // UPI pending screen — shown after order is created, waiting for user to complete payment
  if (upiState === "pending" && upiOrderId) {
    const upiUrl   = buildUpiUrl({ amount: upiAmount, orderId: upiOrderId });
    const appUrls  = buildAppUpiUrls({ amount: upiAmount, orderId: upiOrderId });
    const device   = detectDevice();
    const upiId    = import.meta.env.VITE_UPI_ID as string | undefined;
    const bizName  = (import.meta.env.VITE_UPI_BUSINESS_NAME as string | undefined) ?? "ISHQARA";

    return (
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

        {/* iOS: per-app buttons */}
        {device === "ios" && (
          <div className="space-y-2 mb-4 max-w-xs mx-auto">
            <p className="text-xs text-muted-foreground mb-2">Choose your UPI app</p>
            {appUrls.map((app) => (
              <a
                key={app.label}
                href={app.url}
                className="flex items-center gap-3 w-full p-3 rounded-md border hover:bg-muted transition-colors text-sm font-medium"
              >
                <img src={app.icon} alt={app.label} className="w-6 h-6 object-contain rounded" />
                {app.label}
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </a>
            ))}
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
                      value={buildUpiQrValue({ amount: upiAmount, orderId: upiOrderId })}
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

        <Separator className="my-5 max-w-xs mx-auto" />
        <p className="text-xs text-muted-foreground mb-4">
          After completing the payment in your UPI app, tap the button below to confirm your order.
        </p>
        <Button
          className="w-full max-w-xs mx-auto"
          onClick={() => {
            clearCart();
            setUpiState("confirmed");
            setOrderPlaced(true);
            setPlacedOrderId(upiOrderId);
          }}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" /> I've completed the payment
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Haven't paid yet?{" "}
          <button
            className="text-primary underline underline-offset-2"
            onClick={() => { setUpiState("idle"); setUpiOrderId(null); }}
          >
            Go back
          </button>
        </p>
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8" data-testid="page-checkout">
      <Link href="/cart">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-cart">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Cart
        </Button>
      </Link>

      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-6">Checkout</h1>

      <div className="grid md:grid-cols-3 gap-4 md:gap-8 pb-24 md:pb-0">
        <div className="md:col-span-2 space-y-6">
          <div className="p-5 rounded-md border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Delivery Details</h3>
              {user && (
                <Link href="/account">
                  <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="w-3 h-3" /> Manage addresses
                  </button>
                </Link>
              )}
            </div>

            {/* Saved address picker */}
            {user && addresses && addresses.length > 0 && (
              <div className="mb-5">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Saved addresses
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => { applyAddress(addr); setShowManualForm(false); }}
                      className={`text-left p-3 rounded-md border text-sm transition-colors w-full ${
                        selectedAddressId === addr.id && !showManualForm
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-xs">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] text-primary font-medium">Default</span>
                        )}
                      </div>
                      <p className="font-medium leading-snug">{addr.recipientName}</p>
                      <p className="text-muted-foreground text-xs leading-snug truncate">
                        {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                      </p>
                      <p className="text-muted-foreground text-xs">{addr.city} — {addr.pincode}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualForm((v) => !v)}
                  className="mt-3 text-xs text-primary hover:underline w-full text-center"
                >
                  {showManualForm ? "↑ Hide manual form" : "✎ Enter / edit address manually"}
                </button>
              </div>
            )}

            {/* Manual form — always visible when no saved addresses, toggled otherwise */}
            {(!(user && addresses && addresses.length > 0) || showManualForm) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name</Label>
                <Input value={form.customerName} onChange={handleChange("customerName")} placeholder="Your full name" data-testid="input-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={handleChange("email")} placeholder="you@example.com" data-testid="input-email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input type="tel" value={form.phone} onChange={handleChange("phone")} placeholder="Your phone number" data-testid="input-phone" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input value={form.city} onChange={handleChange("city")} placeholder="City" data-testid="input-city" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input value={form.address} onChange={handleChange("address")} placeholder="Full address" data-testid="input-address" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pincode</Label>
                <Input value={form.pincode} onChange={handleChange("pincode")} placeholder="PIN code" data-testid="input-pincode" />
              </div>
            </div>
            )}
          </div>

          <div className="p-5 rounded-md border">
            <h3 className="font-semibold mb-4">Payment Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className={`flex items-center gap-3 p-4 rounded-md border transition-colors text-left ${
                  paymentMethod === "upi" ? "border-primary bg-primary/5" : "border-border"
                }`}
                onClick={() => setPaymentMethod("upi")}
                data-testid="button-payment-upi"
              >
                <Smartphone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Pay via UPI App</p>
                  <p className="text-xs text-muted-foreground">PhonePe, GPay, Paytm, BHIM</p>
                </div>
              </button>
              <button
                className={`flex items-center gap-3 p-4 rounded-md border transition-colors text-left ${
                  paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-border"
                }`}
                onClick={() => setPaymentMethod("razorpay")}
                data-testid="button-payment-razorpay"
              >
                <CreditCard className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Card / Net Banking</p>
                  <p className="text-xs text-muted-foreground">Credit, Debit, Net Banking (Razorpay)</p>
                </div>
              </button>
            </div>
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
              disabled={!isFormValid || isSubmitting}
              onClick={handlePlaceOrder}
              data-testid="button-place-order"
            >
              {isSubmitting ? "Processing..." : `Place Order - Rs. ${grandTotal.toLocaleString()}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar — shows total + place order */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {shipping === 0 ? "Free shipping" : `+Rs. ${shipping} shipping`}
            {appliedPromo && discountAmount > 0 && ` · -Rs. ${discountAmount}`}
          </p>
          <p className="text-base font-bold" data-testid="text-checkout-total-mobile">Rs. {grandTotal.toLocaleString()}</p>
        </div>
        <Button
          className="flex-1 max-w-[200px]"
          disabled={!isFormValid || isSubmitting}
          onClick={handlePlaceOrder}
          data-testid="button-place-order-mobile"
        >
          {isSubmitting ? "Processing..." : "Place Order"}
        </Button>
      </div>
    </div>
  );
}
