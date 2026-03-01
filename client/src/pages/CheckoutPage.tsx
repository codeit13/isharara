import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, CreditCard, Banknote, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { loadRazorpay } from "@/lib/razorpay";
import type { Order, Promotion } from "@shared/schema";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
  });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  const shipping = totalPrice >= 1499 ? 0 : 99;
  const { data: promotions } = useQuery<Promotion[]>({ queryKey: ["/api/promotions"] });

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
      } else {
        handleOrderSuccess(order);
        toast({ title: "Order placed successfully!" });
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
        <div className="flex gap-3 justify-center">
          <Link href="/account">
            <Button variant="outline" data-testid="button-view-orders">View My Orders</Button>
          </Link>
          <Link href="/shop">
            <Button data-testid="button-continue-shopping">Continue Shopping</Button>
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

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="p-5 rounded-md border">
            <h3 className="font-semibold mb-4">Delivery Details</h3>
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
          </div>

          <div className="p-5 rounded-md border">
            <h3 className="font-semibold mb-4">Payment Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className={`flex items-center gap-3 p-4 rounded-md border transition-colors text-left ${
                  paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border"
                }`}
                onClick={() => setPaymentMethod("cod")}
                data-testid="button-payment-cod"
              >
                <Banknote className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Cash on Delivery</p>
                  <p className="text-xs text-muted-foreground">Pay when you receive</p>
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
                  <p className="text-sm font-medium">Pay Online</p>
                  <p className="text-xs text-muted-foreground">UPI, Card, Net Banking (Razorpay)</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
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
    </div>
  );
}
