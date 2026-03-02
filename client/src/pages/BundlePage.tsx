import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Check, ShoppingBag, Plus, X } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import type { ProductWithSizes } from "@shared/schema";

const BUNDLE_CONFIGS = [
  { count: 2, discount: 10, label: "Pick 2" },
  { count: 3, discount: 15, label: "Pick 3" },
];

export default function BundlePage() {
  const { data: products, isLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });
  const { addItem } = useCart();
  const { toast } = useToast();
  const [bundleConfig, setBundleConfig] = useState(BUNDLE_CONFIGS[0]);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});

  const allProducts = products || [];

  const toggleProduct = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
      const newSizes = { ...selectedSizes };
      delete newSizes[id];
      setSelectedSizes(newSizes);
    } else if (selected.length < bundleConfig.count) {
      setSelected([...selected, id]);
      const product = allProducts.find((p) => p.id === id);
      if (product && product.sizes.length > 0) {
        setSelectedSizes({ ...selectedSizes, [id]: product.sizes[0].size });
      }
    }
  };

  const selectedProducts = allProducts.filter((p) => selected.includes(p.id));
  const totalOriginal = selectedProducts.reduce((sum, p) => {
    const size = p.sizes.find((s) => s.size === (selectedSizes[p.id] || p.sizes[0]?.size));
    return sum + (size?.price || 0);
  }, 0);
  const discountAmount = Math.round(totalOriginal * (bundleConfig.discount / 100));
  const bundleTotal = totalOriginal - discountAmount;
  const isComplete = selected.length === bundleConfig.count;

  const handleAddBundle = () => {
    selectedProducts.forEach((p) => {
      const sizeKey = selectedSizes[p.id] || p.sizes[0]?.size;
      const sizeObj = p.sizes.find((s) => s.size === sizeKey);
      if (sizeObj) {
        const discountedPrice = Math.round(sizeObj.price * (1 - bundleConfig.discount / 100));
        addItem({
          productId: p.id,
          name: `${p.name} (Bundle)`,
          image: p.image,
          size: sizeObj.size,
          price: discountedPrice,
        });
      }
    });
    toast({ title: "Bundle added to bag!", description: `${bundleConfig.label} bundle with ${bundleConfig.discount}% off` });
    setSelected([]);
    setSelectedSizes({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" data-testid="page-bundles">
      <SEOHead
        title="Build Your Own Fragrance Bundle"
        description="Create your perfect fragrance bundle at ISHQARA. Mix and match luxury perfumes, save more when you buy together. Perfect as a gift."
        canonicalPath="/bundles"
      />
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Gift className="w-6 h-6 text-primary" />
        </div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2" data-testid="text-bundle-title">
          Build Your Own Bundle
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Pick your favorite fragrances and save big. Perfect for gifting or treating yourself!
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-8">
        {BUNDLE_CONFIGS.map((cfg) => (
          <button
            key={cfg.count}
            onClick={() => { setBundleConfig(cfg); setSelected([]); setSelectedSizes({}); }}
            className={`px-6 py-3 rounded-md border text-sm font-medium transition-colors ${
              bundleConfig.count === cfg.count
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
            data-testid={`button-bundle-${cfg.count}`}
          >
            <span className="font-bold">{cfg.label}</span>
            <span className="block text-xs mt-0.5">{cfg.discount}% Off</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 md:gap-8 pb-24 md:pb-0">
        <div className="md:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="text-sm font-medium">
              Select {bundleConfig.count} fragrances ({selected.length}/{bundleConfig.count})
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {allProducts.map((product) => {
                const isSelected = selected.includes(product.id);
                const canSelect = selected.length < bundleConfig.count || isSelected;
                return (
                  <div
                    key={product.id}
                    className={`relative rounded-md border p-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : canSelect
                        ? "border-border"
                        : "border-border opacity-40"
                    }`}
                    onClick={() => canSelect && toggleProduct(product.id)}
                    data-testid={`bundle-product-${product.id}`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="aspect-square rounded-md bg-muted/50 mb-2">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-md" />
                    </div>
                    <h3 className="text-xs font-semibold line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                    {isSelected && product.sizes.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                        {product.sizes.map((s) => (
                          <button
                            key={s.size}
                            className={`text-[10px] px-2 py-0.5 rounded border ${
                              selectedSizes[product.id] === s.size
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground"
                            }`}
                            onClick={() => setSelectedSizes({ ...selectedSizes, [product.id]: s.size })}
                          >
                            {s.size}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop bundle summary — hidden on mobile */}
        <div className="md:col-span-1 hidden md:block">
          <div className="sticky top-20 p-5 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Your Bundle</h3>
            </div>

            {selectedProducts.length === 0 ? (
              <div className="text-center py-8">
                <Plus className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Select {bundleConfig.count} fragrances to build your bundle
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {selectedProducts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <img src={p.image} alt={p.name} className="w-10 h-12 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-1">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedSizes[p.id] || p.sizes[0]?.size}</p>
                    </div>
                    <button onClick={() => toggleProduct(p.id)}>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedProducts.length > 0 && (
              <>
                <Separator className="mb-3" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original</span>
                    <span>Rs. {totalOriginal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Bundle Discount ({bundleConfig.discount}%)</span>
                    <span>-Rs. {discountAmount.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Bundle Price</span>
                    <span data-testid="text-bundle-total">Rs. {bundleTotal.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}

            <Button
              className="w-full mt-4"
              disabled={!isComplete}
              onClick={handleAddBundle}
              data-testid="button-add-bundle"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              {isComplete ? "Add Bundle to Bag" : `Select ${bundleConfig.count - selected.length} more`}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {selected.length}/{bundleConfig.count} selected
            {bundleConfig.discount > 0 && ` · ${bundleConfig.discount}% off`}
          </p>
          {isComplete ? (
            <p className="text-base font-bold">Rs. {bundleTotal.toLocaleString()}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Select {bundleConfig.count - selected.length} more</p>
          )}
        </div>
        <Button
          className="flex-1 max-w-[200px]"
          disabled={!isComplete}
          onClick={handleAddBundle}
          data-testid="button-add-bundle-mobile"
        >
          <ShoppingBag className="w-4 h-4 mr-2" />
          {isComplete ? "Add to Bag" : `${selected.length}/${bundleConfig.count}`}
        </Button>
      </div>
    </div>
  );
}
