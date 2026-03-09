import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import SEOHead from "@/components/SEOHead";
import { SlidersHorizontal, X, ChevronDown, Loader2, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ProductCard";
import type { ProductWithSizes } from "@shared/schema";

const PAGE_SIZE = 8;

interface PaginatedResponse {
  products: ProductWithSizes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

function buildApiUrl(
  page: number,
  filters: { category: string; gender: string; productType: string; tag: string; sort: string },
) {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("limit", String(PAGE_SIZE));
  if (filters.category !== "All") p.set("category", filters.category);
  if (filters.gender !== "All") p.set("gender", filters.gender);
  if (filters.productType !== "All") p.set("productType", filters.productType);
  if (filters.tag) p.set("tag", filters.tag);
  if (filters.sort !== "featured") p.set("sort", filters.sort);
  return `/api/products?${p.toString()}`;
}

export default function ShopPage() {
  const [, setLocation] = useLocation();
  const [, forceUpdate] = useState(0);
  // wouter's useLocation() returns pathname only — read query from window so ?search= is detected
  const queryString = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(queryString);
  const filterParam = params.get("filter") || "";
  const searchParam = params.get("search")?.trim() || "";

  const clearSearch = () => {
    window.history.replaceState(null, "", "/shop");
    setLocation("/shop");
    forceUpdate((n) => n + 1);
  };

  // When already on /shop and user searches from navbar, wouter doesn't re-render (pathname unchanged).
  // GlobalSearch dispatches this event so we re-read the URL and show the search UI.
  useEffect(() => {
    const onSearchUpdate = () => forceUpdate((n) => n + 1);
    window.addEventListener("shop-search-update", onSearchUpdate);
    return () => window.removeEventListener("shop-search-update", onSearchUpdate);
  }, []);

  const [category, setCategory] = useState("All");
  const [gender, setGender] = useState("All");
  const [productType, setProductType] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filterState = { category, gender, productType, tag: activeFilter, sort: sortBy };

  // Paginated + filtered product list (used when not searching)
  const {
    data: infiniteData,
    isLoading: isLoadingProducts,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<PaginatedResponse>({
    queryKey: ["/api/products", "paginated", filterState],
    queryFn: async ({ pageParam }) => {
      const url = buildApiUrl(pageParam as number, filterState);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: !searchParam,
  });

  // Search results (non-paginated)
  const { data: searchResults, isLoading: isLoadingSearch } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products/search", searchParam],
    queryFn: async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchParam)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchParam.length >= 1,
  });

  const paginatedProducts = infiniteData?.pages.flatMap((p) => p?.products ?? []) ?? [];
  const totalProductCount = infiniteData?.pages[0]?.total ?? 0;
  const displayProducts = searchParam ? (searchResults ?? []) : paginatedProducts;
  const displayCount = searchParam ? displayProducts.length : totalProductCount;
  const isLoading = searchParam ? isLoadingSearch : isLoadingProducts;

  // Infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !searchParam) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, searchParam]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "300px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Filter options
  const { data: shopFilters } = useQuery<{ categories: string[]; genders: string[]; productTypes: string[] }>({
    queryKey: ["/api/shop-filters"],
  });
  const categories = ["All", ...(shopFilters?.categories ?? [])];
  const genders = ["All", ...(shopFilters?.genders ?? [])];
  const productTypes = ["All", ...(shopFilters?.productTypes ?? [])];

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

  const pageTitle = searchParam
    ? `Search: "${searchParam}"`
    : activeFilter === "bestseller" ? "Bestsellers"
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

      {/* Search results banner */}
      {searchParam ? (
        <div className="mb-6">
          <div className="rounded-xl border bg-muted/30 p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Search results for</p>
                  <h1 className="font-serif text-xl md:text-2xl font-bold leading-tight truncate" data-testid="text-shop-title">
                    "{searchParam}"
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isLoading ? (
                      "Searching…"
                    ) : displayCount === 0 ? (
                      "No results found"
                    ) : (
                      <>{displayCount} result{displayCount !== 1 ? "s" : ""} found</>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 text-xs"
                onClick={clearSearch}
              >
                <X className="h-3.5 w-3.5" />
                Clear search
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header row */}
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="font-serif text-2xl md:text-3xl font-bold mb-1" data-testid="text-shop-title">
                {pageTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                {displayCount} fragrance{displayCount !== 1 ? "s" : ""} to discover
              </p>
            </div>

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
        </>
      )}

      {/* Filter bar — hidden during search */}
      {!searchParam && <div className="mb-6 rounded-xl border bg-muted/30">
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

        <div className={`${filtersOpen ? "block" : "hidden"} md:block px-4 pb-4 md:pt-4`}>
          <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-0 md:divide-x divide-border">

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
      </div>}

      {/* Product grid */}
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
      ) : displayProducts.length === 0 ? (
        <div className="text-center py-20">
          {searchParam ? (
            <>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium mb-1">No results for "{searchParam}"</p>
              <p className="text-sm text-muted-foreground mb-5">
                Try checking for typos, using more general terms, or browsing our full collection.
              </p>
              <Button variant="outline" onClick={clearSearch} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Browse All Products
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4">No products found matching your filters</p>
              <Button variant="outline" onClick={clearAll}>Clear All Filters</Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {displayProducts.map((product) => (
              product ? <ProductCard key={product.id} product={product} /> : null
            ))}
          </div>

          {/* Infinite scroll trigger */}
          {!searchParam && (
            <>
              <div ref={loadMoreRef} className="h-4 w-full" aria-hidden />
              {isFetchingNextPage && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasNextPage && displayProducts.length > 0 && (
                <p className="text-center text-xs text-muted-foreground py-6">
                  You've seen all {displayCount} fragrances
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
