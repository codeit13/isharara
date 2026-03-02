import { Link } from "wouter";
import { Star, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductWithSizes } from "@shared/schema";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";

export default function ProductCard({ product }: { product: ProductWithSizes }) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const lowestPrice = product.sizes.length > 0
    ? Math.min(...product.sizes.map((s) => s.price))
    : 0;
  const lowestOriginalPrice = product.sizes.length > 0
    ? product.sizes.reduce((min, s) => {
        const op = s.originalPrice ?? s.price;
        return op < min ? op : min;
      }, Infinity)
    : 0;
  const hasDiscount = lowestOriginalPrice > lowestPrice;
  const discountPercent = hasDiscount
    ? Math.round(((lowestOriginalPrice - lowestPrice) / lowestOriginalPrice) * 100)
    : 0;
  const smallestSize = product.sizes.length > 0
    ? product.sizes.reduce((s, c) => (c.price < s.price ? c : s))
    : null;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (smallestSize) {
      addItem({
        productId: product.id,
        name: product.name,
        image: product.image,
        size: smallestSize.size,
        price: smallestSize.price,
      });
      toast({ title: "Added to bag", description: `${product.name} (${smallestSize.size})` });
    }
  };

  return (
    <Link href={`/product/${product.id}`}>
      <div className="group cursor-pointer" data-testid={`card-product-${product.id}`}>
        <div className="relative aspect-[3/4] rounded-md bg-muted/50 mb-3">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover rounded-md"
            loading="lazy"
          />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isBestseller && (
              <Badge variant="default" className="text-[10px] px-2 py-0.5" data-testid={`badge-bestseller-${product.id}`}>
                Bestseller
              </Badge>
            )}
            {product.isTrending && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5" data-testid={`badge-trending-${product.id}`}>
                Trending
              </Badge>
            )}
            {product.isNewArrival && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-background/80 backdrop-blur">
                New
              </Badge>
            )}
          </div>
          {hasDiscount && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5" data-testid={`badge-discount-${product.id}`}>
                -{discountPercent}%
              </Badge>
            </div>
          )}
          {/* Always visible on touch devices; hover-revealed on desktop */}
          <div className="absolute bottom-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" onClick={handleQuickAdd} data-testid={`button-quickadd-${product.id}`}>
              <ShoppingBag className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider" data-testid={`text-category-${product.id}`}>
            {product.category}
          </p>
          <h3 className="font-serif text-sm font-semibold leading-tight line-clamp-1" data-testid={`text-name-${product.id}`}>
            {product.name}
          </h3>
          <div className="flex items-center gap-1">
            {Number(product.avgRating) > 0 && (
              <>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium">{Number(product.avgRating).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" data-testid={`text-price-${product.id}`}>
              Rs. {lowestPrice.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                Rs. {lowestOriginalPrice.toLocaleString()}
              </span>
            )}
            {product.sizes.length > 1 && (
              <span className="text-xs text-muted-foreground">onwards</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
