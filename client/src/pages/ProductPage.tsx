import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import SEOHead from "@/components/SEOHead";
import { Star, ShoppingBag, Minus, Plus, ArrowLeft, Truck, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import type { ProductWithSizes, Review } from "@shared/schema";

function StarRating({ rating, onChange, interactive = false }: { rating: number; onChange?: (r: number) => void; interactive?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} ${interactive ? "cursor-pointer" : ""}`}
          onClick={interactive ? () => onChange?.(i) : undefined}
        />
      ))}
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery<ProductWithSizes>({
    queryKey: ["/api/products", id],
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["/api/products", id, "reviews"],
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-[3/4] w-full rounded-md" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Product not found</p>
        <Link href="/shop"><Button variant="outline">Back to Shop</Button></Link>
      </div>
    );
  }

  const selectedSizeObj = product.sizes.find((s) => s.size === selectedSize) || product.sizes[0];
  const currentPrice = selectedSizeObj?.price || 0;
  const originalPrice = selectedSizeObj?.originalPrice ?? currentPrice;
  const hasDiscount = originalPrice > currentPrice;
  const inStock = (selectedSizeObj?.stock || 0) > 0;

  if (!selectedSize && product.sizes.length > 0) {
    setSelectedSize(product.sizes[0].size);
  }

  const handleAddToCart = () => {
    if (!selectedSizeObj) return;
    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: product.id,
        name: product.name,
        image: product.image,
        size: selectedSizeObj.size,
        price: selectedSizeObj.price,
      });
    }
    toast({ title: "Added to bag!", description: `${product.name} (${selectedSizeObj.size}) x${quantity}` });
    setQuantity(1);
  };

  const lowestPrice = product.sizes.length > 0 ? Math.min(...product.sizes.map((s) => s.price)) : 0;
  const highestPrice = product.sizes.length > 0 ? Math.max(...product.sizes.map((s) => s.price)) : 0;
  const isInStock = product.sizes.some((s) => s.stock > 0);
  const productImage = product.image.startsWith("http") ? product.image : `https://ishqara.com${product.image}`;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": productImage,
    "brand": { "@type": "Brand", "name": product.brand || "ISHQARA" },
    "category": product.category,
    ...(Number(product.avgRating) > 0 && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": Number(product.avgRating).toFixed(1),
        "reviewCount": product.reviewCount,
        "bestRating": "5",
        "worstRating": "1",
      },
    }),
    "offers": product.sizes.length === 1
      ? {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": product.sizes[0].price,
          "availability": product.sizes[0].stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          "url": `https://ishqara.com/product/${product.id}`,
          "seller": { "@type": "Organization", "name": "ISHQARA" },
        }
      : {
          "@type": "AggregateOffer",
          "priceCurrency": "INR",
          "lowPrice": lowestPrice,
          "highPrice": highestPrice,
          "offerCount": product.sizes.length,
          "availability": isInStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ishqara.com" },
      { "@type": "ListItem", "position": 2, "name": "Shop", "item": "https://ishqara.com/shop" },
      { "@type": "ListItem", "position": 3, "name": product.name, "item": `https://ishqara.com/product/${product.id}` },
    ],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8" data-testid="page-product">
      <SEOHead
        title={`${product.name} — ${product.category} Perfume`}
        description={`${product.description.slice(0, 155)}…`}
        canonicalPath={`/product/${product.id}`}
        image={productImage}
        type="product"
        jsonLd={[productSchema, breadcrumbSchema]}
      />
      <Link href="/shop">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Shop
        </Button>
      </Link>

      <div className="grid md:grid-cols-2 gap-6 md:gap-12">
        <div className="relative aspect-[3/4] rounded-md bg-muted/50">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-md" />
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.isBestseller && <Badge variant="default" className="text-xs">Bestseller</Badge>}
            {product.isTrending && <Badge variant="secondary" className="text-xs">Trending</Badge>}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{product.category} / {product.gender}</p>
            <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2" data-testid="text-product-name">{product.name}</h1>
            <div className="flex items-center gap-2">
              {Number(product.avgRating) > 0 && (
                <>
                  <StarRating rating={Math.round(Number(product.avgRating))} />
                  <span className="text-sm font-medium">{Number(product.avgRating).toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({product.reviewCount} reviews)</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold" data-testid="text-product-price">Rs. {currentPrice.toLocaleString()}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-muted-foreground line-through">Rs. {originalPrice.toLocaleString()}</span>
                <Badge variant="destructive" className="text-xs">
                  {Math.round(((originalPrice - currentPrice) / originalPrice) * 100)}% OFF
                </Badge>
              </>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-product-desc">{product.description}</p>

          {product.notes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2">Fragrance Notes</p>
              <div className="flex flex-wrap gap-1.5">
                {product.notes.map((note) => (
                  <Badge key={note} variant="outline" className="text-xs">{note}</Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2">Select Size</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s.size}
                  onClick={() => setSelectedSize(s.size)}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    selectedSize === s.size
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  } ${s.stock === 0 ? "opacity-50 line-through" : ""}`}
                  disabled={s.stock === 0}
                  data-testid={`button-size-${s.size}`}
                >
                  {s.size} - Rs. {s.price.toLocaleString()}
                </button>
              ))}
            </div>
            {selectedSizeObj && (
              <p className={`text-xs mt-2 ${inStock ? "text-green-600" : "text-destructive"}`} data-testid="text-stock">
                {inStock ? `${selectedSizeObj.stock} in stock` : "Out of stock"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md">
              <Button size="icon" variant="ghost" onClick={() => setQuantity(Math.max(1, quantity - 1))} data-testid="button-qty-minus">
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-10 text-center text-sm font-medium" data-testid="text-quantity">{quantity}</span>
              <Button size="icon" variant="ghost" onClick={() => setQuantity(quantity + 1)} data-testid="button-qty-plus">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Button className="flex-1" disabled={!inStock} onClick={handleAddToCart} data-testid="button-add-cart">
              <ShoppingBag className="w-4 h-4 mr-2" />
              {inStock ? "Add to Bag" : "Out of Stock"}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="text-center p-2 sm:p-3 rounded-md bg-muted/50">
              <Truck className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Free Delivery ₹1499+</p>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-md bg-muted/50">
              <RotateCcw className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">7-Day Returns</p>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-md bg-muted/50">
              <Shield className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">100% Authentic</p>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-10" />

      {reviews && reviews.length > 0 && (
        <div className="max-w-3xl" data-testid="section-reviews">
          <h2 className="font-serif text-xl font-bold mb-6">Reviews ({reviews.length})</h2>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 rounded-md border" data-testid={`review-${review.id}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {review.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{review.customerName}</p>
                      <StarRating rating={review.rating} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
