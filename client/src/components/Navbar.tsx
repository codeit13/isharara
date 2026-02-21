import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, X, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/deals", label: "Deals" },
  { href: "/bundles", label: "Bundles" },
];

export default function Navbar() {
  const [location] = useLocation();
  const { totalItems } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b" data-testid="navbar">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 h-16">
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-6">
              <div className="mt-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                    <div
                      className={`px-4 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                        location === link.href
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      }`}
                      data-testid={`link-mobile-${link.label.toLowerCase()}`}
                    >
                      {link.label}
                    </div>
                  </Link>
                ))}
                <Link href="/admin" onClick={() => setOpen(false)}>
                  <div className="px-4 py-3 rounded-md text-sm font-medium text-muted-foreground cursor-pointer" data-testid="link-mobile-admin">
                    Admin
                  </div>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Link href="/">
          <span className="font-serif text-xl md:text-2xl font-bold tracking-wider cursor-pointer" data-testid="link-logo">
            ISHQARA
          </span>
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
          <Link href="/admin">
            <Button size="icon" variant="ghost" className="hidden md:flex" data-testid="button-admin">
              <User className="w-5 h-5" />
            </Button>
          </Link>
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
