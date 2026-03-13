import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider, useGoogleOneTapLogin } from "@react-oauth/google";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
// import SubscribePopup from "@/components/SubscribePopup";
import HomePage from "@/pages/HomePage";
import ShopPage from "@/pages/ShopPage";
import ProductPage from "@/pages/ProductPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import DealsPage from "@/pages/DealsPage";
import BundlePage from "@/pages/BundlePage";
import AdminPage from "@/pages/AdminPage";
import AccountPage from "@/pages/AccountPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsPage from "@/pages/TermsPage";
import RefundPolicyPage from "@/pages/RefundPolicyPage";
import ShippingPolicyPage from "@/pages/ShippingPolicyPage";
import ContactPage from "@/pages/ContactPage";
import SuperAdminPage from "@/super-admin/SuperAdminPage";
import TenantDetailPage from "@/super-admin/TenantDetailPage";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useTenant, setTenantSlug } from "@/hooks/use-tenant";

/** Caches the tenant slug and applies brand color as CSS custom property. */
function TenantSlugSync() {
  const tenant = useTenant();
  const [location] = useLocation();
  useEffect(() => {
    if (tenant?.slug) setTenantSlug(tenant.slug);
  }, [tenant?.slug]);

  useEffect(() => {
    const root = document.documentElement;
    // Don't override theme on the platform admin page
    if (location.startsWith("/platform")) {
      root.style.removeProperty("--brand-color");
      root.style.removeProperty("--brand-rgb");
      root.style.removeProperty("--primary");
      return;
    }
    if (!tenant?.brandColor) return;
    const hex = tenant.brandColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty("--brand-color", tenant.brandColor);
    root.style.setProperty("--brand-rgb", `${r} ${g} ${b}`);
    const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const rn = r / 255, gn = g / 255, bn = b / 255;
      if (rn === max) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
      else if (gn === max) h = ((bn - rn) / d + 2) * 60;
      else h = ((rn - gn) / d + 4) * 60;
    }
    root.style.setProperty("--primary", `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
  }, [tenant?.brandColor, location]);

  return null;
}

/** Scrolls to the top of the page on every route change. */
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

/** Displays the One Tap prompt on every page when the user is not signed in. */
function GoogleOneTapPrompt() {
  const { user, isLoading } = useAuth();
  const { handleCredential } = useGoogleAuth();

  useGoogleOneTapLogin({
    onSuccess: (res) => {
      if (res.credential) handleCredential(res.credential);
    },
    disabled: isLoading || !!user,
  });

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/product/:id" component={ProductPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/deals" component={DealsPage} />
      <Route path="/bundles" component={BundlePage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/platform" component={SuperAdminPage} />
      <Route path="/platform/tenants/:id" component={TenantDetailPage} />
      <Route path="/account" component={AccountPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />
      <Route path="/shipping-policy" component={ShippingPolicyPage} />
      <Route path="/contact" component={ContactPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const isPlatform = location.startsWith("/platform");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TenantSlugSync />
      <ScrollToTop />
      {!isPlatform && <Navbar />}
      <main className="flex-1">
        <Router />
      </main>
      {!isPlatform && <Footer />}
    </div>
  );
}

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={clientId ?? ""}>
        <TooltipProvider>
          <AppShell />
          {clientId && <GoogleOneTapPrompt />}
          {/* <SubscribePopup /> */}
          <Toaster />
        </TooltipProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
