import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Sparkles, TrendingUp, Flame, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ProductCard";
import SEOHead from "@/components/SEOHead";
import type { ProductWithSizes, Promotion } from "@shared/schema";

function HeroSection() {
  return (
    <section className="relative w-full" data-testid="section-hero">
      <div className="relative h-[70vh] min-h-[480px] max-h-[640px]">
        {/* Hero banner: recommended 1920×800 px (or 1440×640) for best quality */}
        <img
          src="/images/hero-banner.png"
          alt="The Ishqara Collection"
          className="w-full h-full object-cover"
          width={1920}
          height={800}
        />
        {/* Dark overlay: stronger at bottom and on the left so white text stays readable on light backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
        <div className="absolute inset-0 flex items-end pb-12 md:pb-16">
          <div className="max-w-7xl mx-auto px-4 w-full">
            <div className="max-w-2xl [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
              <Badge variant="outline" className="mb-4 bg-black/40 backdrop-blur border-white/30 text-white text-xs">
                New Collection 2026
              </Badge>
              <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-3 leading-tight md:whitespace-nowrap" data-testid="text-hero-title">
                Love, bottled. Meet Ishqara.
              </h1>
              <p className="text-white text-base md:text-lg font-serif italic mb-2">
                Not just a perfume. A presence.
              </p>
              <p className="text-white text-sm md:text-base mb-6 leading-relaxed max-w-md">
                Discover premium fragrances that make every day special. Starting at just Rs. 499.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/shop">
                  <Button variant="default" data-testid="button-shop-now">
                    Shop Now <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <Link href="/deals">
                  <Button variant="outline" className="bg-white/10 backdrop-blur border-white/30 text-white" data-testid="button-inaugural-offer">
                    Inaugural Offer
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PromoBanner() {
  const { data: promotions } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions"],
  });

  const activePromos = promotions?.filter((p) => p.isActive).slice(0, 3) || [];
  if (activePromos.length === 0) return null;

  return (
    <section className="bg-primary/5 py-3" data-testid="section-promo-banner">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-center gap-2 text-center">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm font-medium">
            {activePromos[0].title} - {activePromos[0].description}
            {activePromos[0].code && (
              <span className="ml-1 font-bold text-primary">Code: {activePromos[0].code}</span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function ProductSection({
  title,
  icon,
  products,
  loading,
  viewAllHref,
}: {
  title: string;
  icon: React.ReactNode;
  products: ProductWithSizes[];
  loading: boolean;
  viewAllHref: string;
}) {
  return (
    <section className="py-10 md:py-14">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-serif text-xl md:text-2xl font-bold">{title}</h2>
          </div>
          <Link href={viewAllHref}>
            <Button variant="ghost" size="sm" data-testid={`button-viewall-${title.toLowerCase().replace(/\s/g, '-')}`}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full rounded-md" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BundleCTA() {
  return (
    <section className="py-10 md:py-14" data-testid="section-bundle-cta">
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative rounded-md bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/30">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="p-5 sm:p-8 md:p-12">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wider">Inaugural Offer</span>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">
                Buy 2 Get 1 Free
              </h2>
              <p className="text-foreground text-sm md:text-base mb-6 leading-relaxed">
                Pick 2 or 3 perfumes and get them at a special price.
                Perfect for gifting or treating yourself.
              </p>
              <Link href="/deals">
                <Button data-testid="button-inaugural-offer-cta">
                  View Offer <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="hidden md:block p-4">
              {/* Bundle/offer image: recommended 600×400 px */}
              <img
                src="/images/bundle-gift.png"
                alt="Ishqara Offer"
                className="w-full max-w-sm mx-auto rounded-md"
                width={600}
                height={400}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SizeGuide() {
  const sizes = [
    { size: "50ml", desc: "Everyday Fav", price: "Starting Rs. 499", icon: "Best value" },
    { size: "100ml", desc: "Full Experience", price: "Starting Rs. 799", icon: "Lasts longer" },
  ];

  return (
    <section className="py-10 md:py-14 bg-card/50" data-testid="section-sizes">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <h2 className="font-serif text-xl md:text-2xl font-bold mb-2">Find Your Perfect Size</h2>
        <p className="text-sm text-foreground mb-8">Every scent, every budget. Start small, go big.</p>
        <div className="grid grid-cols-2 gap-3 md:gap-6 max-w-xl mx-auto">
          {sizes.map((s) => (
            <div key={s.size} className="p-4 md:p-6 rounded-md bg-background border text-center">
              <p className="font-serif text-2xl md:text-3xl font-bold text-primary mb-1">{s.size}</p>
              <p className="text-sm font-medium mb-1">{s.desc}</p>
              <p className="text-xs text-muted-foreground mb-2">{s.icon}</p>
              <p className="text-xs font-semibold">{s.price}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { data: allProducts, isLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });

  const bestsellers = (allProducts || []).filter((p) => p.isBestseller).slice(0, 4);
  const trending = (allProducts || []).filter((p) => p.isTrending).slice(0, 4);
  const newArrivals = (allProducts || []).filter((p) => p.isNewArrival).slice(0, 4);

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ISHQARA",
    "url": "https://ishqara.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://ishqara.com/shop?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ISHQARA",
    "url": "https://ishqara.com",
    "logo": "https://ishqara.com/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-98679-02305",
      "contactType": "customer service",
      "availableLanguage": ["English", "Hindi"],
    },
    "sameAs": ["https://www.instagram.com/ishqaraperfumes"],
  };

  return (
    <div>
      <SEOHead
        title="The Ishqara Collection — Premium Fragrances"
        description="Experience Ishqara today: A scent that stays longer than words. Shop The Ishqara Collection & recreations. Free shipping above Rs. 1499."
        canonicalPath="/"
        jsonLd={[websiteSchema, orgSchema]}
      />
      <PromoBanner />
      <HeroSection />

      <ProductSection
        title="Bestsellers"
        icon={<Flame className="w-5 h-5 text-primary" />}
        products={bestsellers}
        loading={isLoading}
        viewAllHref="/shop?filter=bestseller"
      />

      <SizeGuide />

      <ProductSection
        title="Trending Now"
        icon={<TrendingUp className="w-5 h-5 text-primary" />}
        products={trending}
        loading={isLoading}
        viewAllHref="/shop?filter=trending"
      />

      <BundleCTA />

      {newArrivals.length > 0 && (
        <ProductSection
          title="New Arrivals"
          icon={<Sparkles className="w-5 h-5 text-primary" />}
          products={newArrivals}
          loading={isLoading}
          viewAllHref="/shop?filter=new"
        />
      )}
    </div>
  );
}
