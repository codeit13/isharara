import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProductWithSizes } from "@shared/schema";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 280;
const MAX_SUGGESTIONS = 6;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function fetchSearchResults(q: string): Promise<ProductWithSizes[]> {
  const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export default function GlobalSearch({
  onNavigate,
  className = "",
  inputRef: externalInputRef,
  fullWidthDropdown = false,
}: {
  onNavigate?: () => void;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  fullWidthDropdown?: boolean;
}) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isLoading, isFetching } = useQuery({
    queryKey: ["/api/products/search", debouncedQuery],
    queryFn: () => fetchSearchResults(debouncedQuery),
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 60_000,
  });

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH;
  const displayResults = results.slice(0, MAX_SUGGESTIONS);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      setLocation(`/shop?search=${encodeURIComponent(q)}`);
      setOpen(false);
      onNavigate?.();
      // ShopPage may already be mounted; wouter won't re-render when only query changes
      window.dispatchEvent(new CustomEvent("shop-search-update"));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
      onNavigate?.();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={externalInputRef}
            type="search"
            placeholder="Search products…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && setOpen(true)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-3 w-full md:w-56 lg:w-64 h-9 bg-muted/50 border-border"
            autoComplete="off"
            aria-label="Search products"
            aria-expanded={showDropdown}
            aria-controls="search-results"
            aria-autocomplete="list"
          />
          {(isLoading || isFetching) && debouncedQuery.length >= MIN_QUERY_LENGTH && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin pointer-events-none" />
          )}
        </div>
      </form>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className={
            fullWidthDropdown
              ? "fixed left-0 right-0 top-16 border-b bg-popover text-popover-foreground shadow-lg z-[60] max-h-[min(60vh,400px)] flex flex-col"
              : "absolute top-full left-0 right-0 mt-1 rounded-lg border bg-popover text-popover-foreground shadow-lg z-50 max-h-[min(70vh,400px)] flex flex-col"
          }
        >
          {isLoading && debouncedQuery === query.trim() ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Searching…</div>
          ) : displayResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No products found for &quot;{query.trim()}&quot;</div>
          ) : (
            <>
              <ul className="py-1 min-h-0 flex-1 overflow-y-auto">
                {displayResults.map((product) => {
                  const minPrice = product.sizes.length > 0
                    ? Math.min(...product.sizes.map((s) => s.price))
                    : 0;
                  return (
                    <li key={product.id} role="option">
                      <Link
                        href={`/product/${product.id}`}
                        onClick={() => {
                          setOpen(false);
                          setQuery("");
                          onNavigate?.();
                        }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/80 transition-colors"
                      >
                        <img
                          src={product.image}
                          alt=""
                          className="w-12 h-12 object-cover rounded border bg-muted shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[product.category, product.productType].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {minPrice > 0 && (
                          <span className="text-sm font-medium shrink-0">₹{minPrice}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t p-2 shrink-0 bg-popover">
                <Link
                  href={`/shop?search=${encodeURIComponent(query.trim())}`}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                    // ShopPage may already be mounted; notify it to re-read URL
                    setTimeout(() => window.dispatchEvent(new CustomEvent("shop-search-update")), 0);
                  }}
                  className="block text-center text-sm font-medium text-primary hover:underline py-2"
                >
                  View all results ({results.length})
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
