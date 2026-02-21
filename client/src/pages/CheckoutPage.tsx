import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, CreditCard, Banknote, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
  });

  const shipping = totalPrice >= 1499 ? 0 : 99;
  const grandTotal = totalPrice + shipping;

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const orderItems = items.map((i) => ({
        productId: i.productId,
        name: i.name,
        size: i.size,
        price: i.price,
        quantity: i.quantity,
      }));
      await apiRequest("POST", "/api/orders", {
        ...form,
        items: orderItems,
        subtotal: totalPrice,
        discount: 0,
        total: grandTotal,
        paymentMethod,
      });
    },
    onSuccess: () => {
      clearCart();
      setOrderPlaced(true);
    },
    onError: () => {
      toast({ title: "Failed to place order", description: "Please try again", variant: "destructive" });
    },
  });

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
        <p className="text-sm text-muted-foreground mb-6">
          Thank you for your order. We'll send you a confirmation email with tracking details shortly.
        </p>
        <Link href="/shop">
          <Button data-testid="button-continue-shopping">Continue Shopping</Button>
        </Link>
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
                  <p className="text-xs text-muted-foreground">UPI, Card, Net Banking</p>
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
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span data-testid="text-checkout-total">Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>
            <Button
              className="w-full mt-4"
              disabled={!isFormValid || placeOrderMutation.isPending}
              onClick={() => placeOrderMutation.mutate()}
              data-testid="button-place-order"
            >
              {placeOrderMutation.isPending ? "Placing Order..." : `Place Order - Rs. ${grandTotal.toLocaleString()}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
