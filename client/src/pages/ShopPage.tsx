import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import SEOHead from "@/components/SEOHead";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ProductCard";
import type { ProductWithSizes } from "@shared/schema";

const categories = ["All", "Floral", "Oriental", "Woody", "Fresh", "Citrus"];
const genders = ["All", "Women", "Men", "Unisex"];
const productTypes = ["All", "The Ishqara Collection", "Recreations"];

function FilterPill({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default function ShopPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const filterParam = params.get("filter") || "";

  const [category, setCategory] = useState("All");
  const [gender, setGender] = useState("All");
  const [productType, setProductType] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: products, isLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });

  let filtered = products || [];

  if (activeFilter === "bestseller") filtered = filtered.filter((p) => p.isBestseller);
  else if (activeFilter === "trending") filtered = filtered.filter((p) => p.isTrending);
  else if (activeFilter === "new") filtered = filtered.filter((p) => p.isNewArrival);

  if (category !== "All") filtered = filtered.filter((p) => p.category === category);
  if (gender !== "All") filtered = filtered.filter((p) => p.gender.toLowerCase() === gender.toLowerCase());
  if (productType === "The Ishqara Collection") filtered = filtered.filter((p) => (p as any).productType === "og");
  else if (productType === "Recreations") filtered = filtered.filter((p) => (p as any).productType === "recreation");

  if (sortBy === "price-low") {
    filtered = [...filtered].sort((a, b) => Math.min(...a.sizes.map((s) => s.price)) - Math.min(...b.sizes.map((s) => s.price)));
  } else if (sortBy === "price-high") {
    filtered = [...filtered].sort((a, b) => Math.min(...b.sizes.map((s) => s.price)) - Math.min(...a.sizes.map((s) => s.price)));
  } else if (sortBy === "rating") {
    filtered = [...filtered].sort((a, b) => Number(b.avgRating) - Number(a.avgRating));
  }

  const activeFilterCount = [
    category !== "All",
    gender !== "All",
    productType !== "All",
    !!activeFilter,
  ].filter(Boolean).length;

  const clearAll = () => {
    setCategory("All");
    setGender("All");
    setProductType("All");
    setActiveFilter("");
  };

  const pageTitle =
    activeFilter === "bestseller" ? "Bestsellers"
    : activeFilter === "trending" ? "Trending Now"
    : activeFilter === "new" ? "New Arrivals"
    : "All Perfumes";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" data-testid="page-shop">
      <SEOHead
        title="Shop Perfumes — Browse All Fragrances"
        description="Browse ISHQARA's full collection of luxury fragrances. Filter by scent family, gender, and product type. Authentic OG & recreation perfumes."
        canonicalPath="/shop"
      />

      {/* Header row */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold mb-1" data-testid="text-shop-title">
            {pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} fragrance{filtered.length !== 1 ? "s" : ""} to discover
          </p>
        </div>

        {/* Sort — always visible */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px] text-xs flex-shrink-0" data-testid="select-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="price-low">Price: Low → High</SelectItem>
            <SelectItem value="price-high">Price: High → Low</SelectItem>
            <SelectItem value="rating">Top Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filter bar */}
      <div className="mb-6 rounded-xl border bg-muted/30">
        {/* Toggle header on mobile */}
        <button
          className="w-full flex items-center justify-between px-4 py-3 md:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Filter groups — always visible on md+, collapsible on mobile */}
        <div className={`${filtersOpen ? "block" : "hidden"} md:block px-4 pb-4 md:pt-4`}>
          <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-0 md:divide-x divide-border">

            {/* Category */}
            <div className="md:pr-5 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Scent Family</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <FilterPill
                    key={c}
                    label={c}
                    active={category === c}
                    onClick={() => setCategory(c)}
                    testId={`filter-category-${c.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            {/* Gender */}
            <div className="md:px-5 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">For</p>
              <div className="flex flex-wrap gap-1.5">
                {genders.map((g) => (
                  <FilterPill
                    key={g}
                    label={g}
                    active={gender === g}
                    onClick={() => setGender(g)}
                    testId={`filter-gender-${g.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            {/* Product Type */}
            <div className="md:px-5 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Product Type</p>
              <div className="flex flex-wrap gap-1.5">
                {productTypes.map((t) => (
                  <FilterPill
                    key={t}
                    label={t}
                    active={productType === t}
                    onClick={() => setProductType(t)}
                    testId={`filter-type-${t.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            {/* Active tag filter + Clear */}
            {(activeFilter || activeFilterCount > 0) && (
              <div className="md:pl-5 md:ml-auto flex flex-col justify-center gap-2">
                {activeFilter && (
                  <button
                    onClick={() => setActiveFilter("")}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border border-primary/40 bg-primary/5 text-primary font-medium"
                  >
                    {activeFilter === "bestseller" ? "Bestsellers"
                      : activeFilter === "trending" ? "Trending"
                      : "New Arrivals"}
                    <X className="w-3 h-3" />
                  </button>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors text-left"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] w-full rounded-md" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">No perfumes found matching your filters</p>
          <Button variant="outline" onClick={clearAll}>
            Clear All Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
