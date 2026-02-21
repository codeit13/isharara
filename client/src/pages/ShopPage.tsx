import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ProductCard";
import type { ProductWithSizes } from "@shared/schema";

const categories = ["All", "Floral", "Oriental", "Woody", "Fresh", "Citrus"];
const genders = ["All", "Women", "Men", "Unisex"];

export default function ShopPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const filterParam = params.get("filter") || "";

  const [category, setCategory] = useState("All");
  const [gender, setGender] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [activeFilter, setActiveFilter] = useState(filterParam);

  const { data: products, isLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });

  let filtered = products || [];

  if (activeFilter === "bestseller") filtered = filtered.filter((p) => p.isBestseller);
  else if (activeFilter === "trending") filtered = filtered.filter((p) => p.isTrending);
  else if (activeFilter === "new") filtered = filtered.filter((p) => p.isNewArrival);

  if (category !== "All") filtered = filtered.filter((p) => p.category === category);
  if (gender !== "All") filtered = filtered.filter((p) => p.gender.toLowerCase() === gender.toLowerCase());

  if (sortBy === "price-low") {
    filtered = [...filtered].sort((a, b) => {
      const aMin = Math.min(...a.sizes.map((s) => s.price));
      const bMin = Math.min(...b.sizes.map((s) => s.price));
      return aMin - bMin;
    });
  } else if (sortBy === "price-high") {
    filtered = [...filtered].sort((a, b) => {
      const aMin = Math.min(...a.sizes.map((s) => s.price));
      const bMin = Math.min(...b.sizes.map((s) => s.price));
      return bMin - aMin;
    });
  } else if (sortBy === "rating") {
    filtered = [...filtered].sort((a, b) => Number(b.avgRating) - Number(a.avgRating));
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" data-testid="page-shop">
      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2" data-testid="text-shop-title">
          {activeFilter === "bestseller" ? "Bestsellers" : activeFilter === "trending" ? "Trending Now" : activeFilter === "new" ? "New Arrivals" : "All Perfumes"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} fragrance{filtered.length !== 1 ? "s" : ""} to discover
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex items-center gap-1 mr-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filters:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Badge
              key={c}
              variant={category === c ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setCategory(c)}
              data-testid={`filter-category-${c.toLowerCase()}`}
            >
              {c}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 ml-2 pl-2 border-l">
          {genders.map((g) => (
            <Badge
              key={g}
              variant={gender === g ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setGender(g)}
              data-testid={`filter-gender-${g.toLowerCase()}`}
            >
              {g}
            </Badge>
          ))}
        </div>

        {activeFilter && (
          <Badge variant="secondary" className="cursor-pointer text-xs ml-2" onClick={() => setActiveFilter("")}>
            {activeFilter} <X className="w-3 h-3 ml-1" />
          </Badge>
        )}

        <div className="ml-auto">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] text-xs" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
            </SelectContent>
          </Select>
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
          <Button variant="outline" onClick={() => { setCategory("All"); setGender("All"); setActiveFilter(""); }}>
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
