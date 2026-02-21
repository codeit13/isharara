import { Link } from "wouter";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice } = useCart();
  const shipping = totalPrice >= 1499 ? 0 : 99;
  const grandTotal = totalPrice + shipping;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center" data-testid="page-cart-empty">
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
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8" data-testid="page-cart">
      <Link href="/shop">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-shop">
          <ArrowLeft className="w-4 h-4 mr-1" /> Continue Shopping
        </Button>
      </Link>

      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-6" data-testid="text-cart-title">
        Your Bag ({items.reduce((s, i) => s + i.quantity, 0)} items)
      </h1>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.size}`}
              className="flex gap-4 p-4 rounded-md border"
              data-testid={`cart-item-${item.productId}-${item.size}`}
            >
              <Link href={`/product/${item.productId}`}>
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-24 object-cover rounded-md cursor-pointer flex-shrink-0"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold line-clamp-1">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Size: {item.size}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="flex-shrink-0"
                    onClick={() => removeItem(item.productId, item.size)}
                    data-testid={`button-remove-${item.productId}-${item.size}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center border rounded-md">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="ghost"
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
        </div>

        <div className="md:col-span-1">
          <div className="sticky top-20 p-5 rounded-md border bg-card">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>Rs. {totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? "Free" : `Rs. ${shipping}`}</span>
              </div>
              {shipping > 0 && (
                <p className="text-[10px] text-primary">Add Rs. {(1499 - totalPrice).toLocaleString()} more for free shipping</p>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span data-testid="text-cart-total">Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>
            <Link href="/checkout">
              <Button className="w-full mt-4" data-testid="button-checkout">
                Proceed to Checkout
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
