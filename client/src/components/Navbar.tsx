import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, User, LogOut, Package, Shield, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useSettings } from "@/hooks/use-settings";
import GlobalSearch from "@/components/GlobalSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Navbar() {
  const [location] = useLocation();
  const { totalItems } = useCart();
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const { user, isLoading, isAuthenticated, isTenantAdmin } = useAuth();
  const tenant = useTenant();
  const { dealsEnabled } = useSettings();

  useEffect(() => {
    if (mobileSearchOpen && mobileInputRef.current) {
      setTimeout(() => mobileInputRef.current?.focus(), 150);
    }
  }, [mobileSearchOpen]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    ...(dealsEnabled ? [{ href: "/deals", label: "Deals" }] : []),
  ];
  const logoSrc = tenant?.logo || "/logo.png";
  const logoAlt = tenant?.name || "Store";

  const getInitials = () => {
    if (!user) return "U";
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b" data-testid="navbar">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 h-16 relative">

        {/* Left group: hamburger + logo on mobile; logo only on desktop — stays left */}
        <div className="flex items-center gap-2 md:gap-4 justify-start min-w-0">
        <div className="flex items-center gap-2 md:hidden z-10 shrink-0">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              {/* Sidebar header with logo */}
              <div className="flex items-center gap-3 px-5 py-4 border-b">
                <Link href="/" onClick={() => setOpen(false)}>
                  <img
                    src={logoSrc}
                    alt={logoAlt}
                    className="h-10 w-auto object-contain cursor-pointer"
                  />
                </Link>
              </div>

              {/* Nav links */}
              <div className="px-3 pt-4 pb-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                    <div
                      className={`px-4 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                        location === link.href
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      data-testid={`link-mobile-${link.label.toLowerCase()}`}
                    >
                      {link.label}
                    </div>
                  </Link>
                ))}

                {isAuthenticated && (
                  <Link href="/account" onClick={() => setOpen(false)}>
                    <div className="px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer" data-testid="link-mobile-account">
                      My Account
                    </div>
                  </Link>
                )}
                {isTenantAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)}>
                    <div className="px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer" data-testid="link-mobile-admin">
                      Admin
                    </div>
                  </Link>
                )}
                {user?.isSuperAdmin && (
                  <Link href="/platform" onClick={() => setOpen(false)}>
                    <div className="px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
                      Platform
                    </div>
                  </Link>
                )}

                {/* Auth actions at the bottom of sidebar */}
                {!isAuthenticated && !isLoading && (
                  <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <Button variant="outline" className="w-full">Login</Button>
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)}>
                      <Button className="w-full">Sign up</Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo — left-aligned on mobile (next to hamburger) */}
        <Link href="/" className="shrink-0">
          <img
            src={logoSrc}
            alt={logoAlt}
            className="h-10 md:h-12 w-auto cursor-pointer object-contain"
            data-testid="link-logo"
          />
        </Link>
        </div>

        {/* Mobile: search icon that expands into full-width overlay */}
        <div className="flex-1 md:hidden" />
        <Button
          size="icon"
          variant="ghost"
          className="md:hidden shrink-0"
          onClick={() => setMobileSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* Mobile search overlay */}
        <div
          className={`md:hidden fixed inset-x-0 top-0 z-[60] bg-background border-b transition-all duration-200 ease-out ${
            mobileSearchOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-2 px-3 h-16">
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0"
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </Button>
            <GlobalSearch
              onNavigate={() => setMobileSearchOpen(false)}
              className="flex-1 min-w-0"
              inputRef={mobileInputRef}
              fullWidthDropdown
            />
          </div>
        </div>
        {mobileSearchOpen && (
          <div
            className="md:hidden fixed inset-0 top-16 z-[55] bg-black/20 backdrop-blur-[1px]"
            onClick={() => setMobileSearchOpen(false)}
          />
        )}

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  location === link.href
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                data-testid={`link-nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="hidden md:block flex-1 max-w-md mx-2">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium" data-testid="text-user-name">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-user-email">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <Link href="/account">
                  <DropdownMenuItem className="cursor-pointer" data-testid="link-account">
                    <Package className="mr-2 h-4 w-4" />
                    My Orders
                  </DropdownMenuItem>
                </Link>
                {isTenantAdmin && (
                  <Link href="/admin">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-admin">
                      <User className="mr-2 h-4 w-4" />
                      Admin
                    </DropdownMenuItem>
                  </Link>
                )}
                {user?.isSuperAdmin && (
                  <Link href="/platform">
                    <DropdownMenuItem className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Platform
                    </DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive"
                  onClick={() => { window.location.href = "/api/logout"; }}
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm font-medium"
                  data-testid="button-login"
                >
                  <User className="w-4 h-4 mr-1" />
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  variant="default"
                  size="sm"
                  className="text-sm font-medium"
                  data-testid="button-register"
                >
                  Sign up
                </Button>
              </Link>
            </>
          )}
          <Link href="/cart">
            <Button size="icon" variant="ghost" className="relative" data-testid="button-cart">
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" data-testid="text-cart-count">
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
