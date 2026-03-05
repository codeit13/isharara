import { Link } from "wouter";
import { SiInstagram, SiWhatsapp } from "react-icons/si";
import { useSettings } from "@/hooks/use-settings";

export default function Footer() {
  const { upiId, storePhone, codEnabled, razorpayEnabled, freeShippingThreshold } = useSettings();
  const whatsappNumber = storePhone?.replace(/\D/g, "") || "919867902305";
  return (
    <footer className="border-t bg-card/50 mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <img src="/logo.png" alt="ISHQARA" className="h-12 w-auto object-contain mb-3" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Experience Ishqara today: A scent that stays longer than words.
              <br />
              Try it. Love it. Wear it.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="https://www.instagram.com/ishqaraperfumes" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Instagram">
                <SiInstagram className="w-5 h-5" />
              </a>
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="WhatsApp">
                <SiWhatsapp className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Shop</h4>
            <div className="flex flex-col gap-2">
              <Link href="/shop" className="text-sm text-muted-foreground">All Perfumes</Link>
              <Link href="/deals" className="text-sm text-muted-foreground">Deals & Offers</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Help</h4>
            <div className="flex flex-col gap-2">
              <Link href="/shipping-policy" className="text-sm text-muted-foreground">Shipping Info</Link>
              <Link href="/refund-policy" className="text-sm text-muted-foreground">Returns &amp; Refunds</Link>
              <Link href="/contact" className="text-sm text-muted-foreground">Contact Us</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Payments</h4>
            <p className="text-sm text-muted-foreground mb-2">
              {codEnabled && razorpayEnabled
                ? "We accept COD & online payments via Razorpay"
                : codEnabled
                ? "We accept Cash on Delivery"
                : razorpayEnabled
                ? "We accept online payments via Razorpay"
                : "We accept prepaid orders via UPI"}
            </p>
            <p className="text-sm text-muted-foreground">
              {freeShippingThreshold > 0
                ? `Free shipping on orders above Rs. ${freeShippingThreshold.toLocaleString()}`
                : "Free shipping on all orders"}
            </p>
          </div>
        </div>

        <div className="border-t mt-8 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p className="order-2 md:order-1">
              &copy; {new Date().getFullYear()} ISHQARA. All rights reserved. Crafted with love.
            </p>
            <div className="flex items-center gap-3 order-1 md:order-2">
              <Link href="/privacy-policy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
