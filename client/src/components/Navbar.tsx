import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, X, User, LogOut, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/deals", label: "Deals" },
];

export default function Navbar() {
  const [location] = useLocation();
  const { totalItems } = useCart();
  const [open, setOpen] = useState(false);
  const { user, isLoading, isAuthenticated } = useAuth();

  const getInitials = () => {
    if (!user) return "U";
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b" data-testid="navbar">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 h-16 relative">

        {/* Hamburger — mobile only */}
        <div className="flex items-center gap-2 md:hidden z-10">
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
                    src="/logo.png"
                    alt="ISHQARA"
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
                {user?.isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)}>
                    <div className="px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer" data-testid="link-mobile-admin">
                      Admin
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

        {/* Logo — absolutely centered on mobile, static on desktop */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
          <img
            src="/logo.png"
            alt="ISHQARA"
            className="h-10 md:h-12 w-auto cursor-pointer object-contain"
            data-testid="link-logo"
          />
        </Link>

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

        <div className="flex items-center gap-1">
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
                {user?.isAdmin && (
                  <Link href="/admin">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-admin">
                      <User className="mr-2 h-4 w-4" />
                      Admin
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
