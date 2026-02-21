import { Link } from "wouter";
import { SiInstagram, SiWhatsapp } from "react-icons/si";

export default function Footer() {
  return (
    <footer className="border-t bg-card/50 mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <h3 className="font-serif text-xl font-bold tracking-wider mb-3">ISHQARA</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Premium fragrances crafted for those who believe in treating themselves. 
              Discover your signature scent.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="text-muted-foreground transition-colors" aria-label="Instagram">
                <SiInstagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors" aria-label="WhatsApp">
                <SiWhatsapp className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Shop</h4>
            <div className="flex flex-col gap-2">
              <Link href="/shop" className="text-sm text-muted-foreground">All Perfumes</Link>
              <Link href="/deals" className="text-sm text-muted-foreground">Deals & Offers</Link>
              <Link href="/bundles" className="text-sm text-muted-foreground">Gift Bundles</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Help</h4>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Shipping Info</span>
              <span className="text-sm text-muted-foreground">Returns & Exchange</span>
              <span className="text-sm text-muted-foreground">Contact Us</span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Payments</h4>
            <p className="text-sm text-muted-foreground mb-2">We accept COD & online payments via Razorpay</p>
            <p className="text-sm text-muted-foreground">Free shipping on orders above Rs. 1,499</p>
          </div>
        </div>

        <div className="border-t mt-8 pt-6">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} ISHQARA. All rights reserved. Crafted with love.
          </p>
        </div>
      </div>
    </footer>
  );
}
