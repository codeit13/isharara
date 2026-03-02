import { useQuery } from "@tanstack/react-query";
import { Tag, Clock, Percent, Gift } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ProductCard";
import type { ProductWithSizes, Promotion } from "@shared/schema";

export default function DealsPage() {
  const { data: promotions, isLoading: promoLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions"],
  });

  const { data: products, isLoading: prodLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });

  const activePromos = promotions?.filter((p) => p.isActive) || [];

  const discountedProducts = (products || []).filter((p) =>
    p.sizes.some((s) => s.originalPrice && s.originalPrice > s.price)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" data-testid="page-deals">
      <SEOHead
        title="Deals & Offers — Exclusive Fragrance Discounts"
        description="Shop ISHQARA's best deals and limited-time offers on premium fragrances. Save on luxury perfumes and gift sets."
        canonicalPath="/deals"
      />
      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2" data-testid="text-deals-title">
          Deals & Offers
        </h1>
        <p className="text-sm text-muted-foreground">
          Grab these exclusive deals before they're gone
        </p>
      </div>

      {promoLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-md" />)}
        </div>
      ) : activePromos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10" data-testid="section-promo-cards">
          {activePromos.map((promo) => (
            <div
              key={promo.id}
              className="relative p-6 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10"
              data-testid={`promo-card-${promo.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {promo.discountType === "percentage" ? (
                    <Percent className="w-5 h-5 text-primary" />
                  ) : promo.discountType === "bundle" ? (
                    <Gift className="w-5 h-5 text-primary" />
                  ) : (
                    <Tag className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{promo.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{promo.description}</p>
                  {promo.code && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {promo.code}
                    </Badge>
                  )}
                  {promo.endDate && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Ends {new Date(promo.endDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 mb-10 rounded-md bg-muted/30">
          <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No active promotions right now. Check back soon!</p>
        </div>
      )}

      <h2 className="font-serif text-xl font-bold mb-6">On Sale</h2>
      {prodLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] w-full rounded-md" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : discountedProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {discountedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No discounted products right now</p>
        </div>
      )}
    </div>
  );
}
