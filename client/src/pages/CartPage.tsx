import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Link } from "wouter";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Shield, RotateCcw, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/hooks/use-settings";
import ProductCard from "@/components/ProductCard";
import SEOHead from "@/components/SEOHead";
import type { ProductWithSizes } from "@shared/schema";

// ── Free-shipping progress bar ────────────────────────────────────────────────
function ShippingProgress({ total, threshold, fee }: { total: number; threshold: number; fee: number }) {
  const remaining = Math.max(0, threshold - total);
  const pct = Math.min(100, Math.round((total / threshold) * 100));
  const free = remaining === 0;
  const firedRef = useRef(false);

  useEffect(() => {
    if (free && !firedRef.current) {
      firedRef.current = true;
      // burst from both bottom corners
      const fire = (x: number) =>
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { x, y: 0.9 },
          colors: ["#e11d48", "#f43f5e", "#fda4af", "#fbbf24", "#34d399"],
          zIndex: 9999,
        });
      fire(0.2);
      setTimeout(() => fire(0.8), 120);
    }
    if (!free) firedRef.current = false;
  }, [free]);

  return (
    <div
      className={`rounded-lg border px-4 py-3 mb-4 transition-colors duration-500 ${
        free ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-primary/5"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${free ? "text-green-700 dark:text-green-400" : ""}`}>
          {free
            ? "🎉 You've unlocked free shipping!"
            : `Add Rs. ${remaining.toLocaleString()} more for free shipping`}
        </span>
        {!free && fee > 0 && (
          <span className="text-[10px] text-muted-foreground">saves Rs. {fee}</span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            free ? "bg-green-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Trust badges ─────────────────────────────────────────────────────────────
function TrustBadges() {
  const badges = [
    { icon: Shield, label: "Secure Checkout" },
    { icon: RotateCcw, label: "Easy Returns" },
    { icon: Zap,    label: "Fast Dispatch" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
      {badges.map(({ icon: Icon, label }) => (
        <div key={label} className="flex flex-col items-center gap-1 text-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Suggested products ────────────────────────────────────────────────────────
function SuggestedProducts({ cartProductIds }: { cartProductIds: number[] }) {
  const { data: products } = useQuery<ProductWithSizes[]>({ queryKey: ["/api/products"] });

  if (!products) return null;

  // Priority: bestsellers → trending → new arrivals → rest; exclude what's in cart
  const suggestions = [
    ...products.filter((p) => p.isBestseller  && !cartProductIds.includes(p.id)),
    ...products.filter((p) => p.isTrending    && !p.isBestseller && !cartProductIds.includes(p.id)),
    ...products.filter((p) => p.isNewArrival  && !p.isBestseller && !p.isTrending && !cartProductIds.includes(p.id)),
    ...products.filter((p) => !p.isBestseller && !p.isTrending   && !p.isNewArrival && !cartProductIds.includes(p.id)),
  ].slice(0, 6);

  if (suggestions.length === 0) return null;

  return (
    <section className="mt-10 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold">Complete your collection</h2>
        <Link href="/shop">
          <button className="text-xs text-primary flex items-center gap-0.5 hover:underline">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>

      {/* Horizontal scroll on mobile, grid on md+ */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2 md:pb-0">
          {suggestions.map((p) => (
            <div
              key={p.id}
              className="w-[160px] sm:w-[190px] md:w-auto shrink-0 md:shrink snap-start"
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Main cart page ────────────────────────────────────────────────────────────
export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice } = useCart();
  const { shippingFee, freeShippingThreshold } = useSettings();
  const shipping = totalPrice >= freeShippingThreshold ? 0 : shippingFee;
  const grandTotal = totalPrice + shipping;
  const cartProductIds = items.map((i) => i.productId);

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center" data-testid="page-cart-empty">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2">Your Bag is Empty</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Looks like you haven't added any fragrances yet. Let's fix that!
        </p>
        <Link href="/shop">
          <Button data-testid="button-start-shopping">Start Shopping</Button>
        </Link>
        {/* Show suggestions even on empty cart */}
        <div className="max-w-4xl mx-auto mt-12 text-left">
          <SuggestedProducts cartProductIds={[]} />
        </div>
      </div>
    );
  }

  return (
    /* pb-28 on mobile clears the fixed bottom checkout bar for ALL content including suggestions */
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 pb-28 md:pb-8" data-testid="page-cart">
      <SEOHead title="Your Bag" description="Review your ISHQARA shopping bag." noIndex />
      <Link href="/shop">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-shop">
          <ArrowLeft className="w-4 h-4 mr-1" /> Continue Shopping
        </Button>
      </Link>

      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-4" data-testid="text-cart-title">
        Your Bag ({items.reduce((s, i) => s + i.quantity, 0)} items)
      </h1>

      {/* Free shipping progress bar */}
      <ShippingProgress total={totalPrice} threshold={freeShippingThreshold} fee={shippingFee} />

      <div className="grid md:grid-cols-3 gap-4 md:gap-8">
        {/* ── Cart items ── */}
        <div className="md:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.size}`}
              className="flex gap-3 p-3 rounded-xl border bg-card"
              data-testid={`cart-item-${item.productId}-${item.size}`}
            >
              <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-lg cursor-pointer"
                />
              </Link>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                {/* top row: name + delete */}
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <Link href={`/product/${item.productId}`}>
                      <h3 className="text-sm font-semibold line-clamp-2 leading-tight hover:underline cursor-pointer">{item.name}</h3>
                    </Link>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-1">{item.size}</Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="flex-shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeItem(item.productId, item.size)}
                    data-testid={`button-remove-${item.productId}-${item.size}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {/* bottom row: qty stepper + price */}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-none"
                      onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-none"
                      onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-bold">Rs. {(item.price * item.quantity).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Promo code nudge — stacks cleanly on all screen sizes */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 rounded-xl border border-dashed bg-muted/30 text-xs text-muted-foreground">
            <span>🏷️</span>
            <span>Have a discount code? Apply it at checkout.</span>
            <Link href="/checkout" className="text-primary font-medium hover:underline whitespace-nowrap">
              Go to checkout →
            </Link>
          </div>
        </div>

        {/* ── Desktop order summary — hidden on mobile ── */}
        <div className="md:col-span-1 hidden md:block">
          <div className="sticky top-20 p-5 rounded-xl border bg-card shadow-sm">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span>Rs. {totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
                  {shipping === 0 ? "Free 🎉" : `Rs. ${shipping}`}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-[10px] text-primary bg-primary/5 rounded px-2 py-1">
                  Add Rs. {(freeShippingThreshold - totalPrice).toLocaleString()} more to get free shipping
                </p>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span data-testid="text-cart-total">Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>
            <Link href="/checkout">
              <Button className="w-full mt-4" size="lg" data-testid="button-checkout">
                Proceed to Checkout
              </Button>
            </Link>
            <TrustBadges />
          </div>
        </div>
      </div>

      {/* ── Suggested products ── */}
      <SuggestedProducts cartProductIds={cartProductIds} />

      {/* ── Mobile sticky checkout bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs">
              {shipping === 0
                ? <span className="text-green-600 font-medium">Free shipping 🎉</span>
                : <span className="text-muted-foreground">+Rs. {shipping} shipping</span>}
            </p>
            <p className="text-base font-bold" data-testid="text-cart-total">Rs. {grandTotal.toLocaleString()}</p>
          </div>
          <Link href="/checkout" className="flex-1 max-w-[200px]">
            <Button className="w-full" data-testid="button-checkout">
              Checkout
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
