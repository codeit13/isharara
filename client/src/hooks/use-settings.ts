import { useQuery } from "@tanstack/react-query";
import { useTenant } from "./use-tenant";

export type AppSettings = Record<string, string> & {
  shipping_fee: string;
  free_shipping_threshold: string;
  store_name: string;
  store_email: string;
  store_phone: string;
  upi_id: string;
  upi_business_name: string;
  upi_merchant_mode: string;
  upi_merchant_code: string;
  cod_enabled: string;
  min_order_amount: string;
  razorpay_enabled: string;
  badge_delivery_enabled: string;
  badge_delivery_text: string;
  badge_returns_enabled: string;
  badge_returns_text: string;
  badge_authentic_enabled: string;
  badge_authentic_text: string;
  feature_deals_enabled: string;
  feature_bundles_enabled: string;
  feature_reviews_enabled: string;
  feature_subscribe_popup_enabled: string;
  feature_bundle_config: string;
  copy_hero_badge: string;
  copy_hero_title: string;
  copy_hero_tagline: string;
  copy_hero_description: string;
  copy_hero_cta: string;
  copy_footer_tagline: string;
  copy_subscribe_title: string;
  copy_subscribe_body: string;
  copy_subscribe_promo_code: string;
  copy_cart_empty_title: string;
  copy_cart_empty_body: string;
  copy_deals_title: string;
  copy_deals_subtitle: string;
  copy_bundle_title: string;
  copy_bundle_subtitle: string;
  social_instagram_url: string;
  social_whatsapp_number: string;
  contact_address: string;
  contact_hours: string;
};

const DEFAULTS: AppSettings = {
  shipping_fee: "99",
  free_shipping_threshold: "1499",
  store_name: "ISHQARA",
  store_email: "ishqaraperfumes@gmail.com",
  store_phone: "+919867902305",
  upi_id: "",
  upi_business_name: "ISHQARA",
  upi_merchant_mode: "false",
  upi_merchant_code: "5999",
  cod_enabled: "false",
  min_order_amount: "0",
  razorpay_enabled: "true",
  badge_delivery_enabled: "true",
  badge_delivery_text: "Free Delivery ₹{amount}+",
  badge_returns_enabled: "true",
  badge_returns_text: "7-Day Returns",
  badge_authentic_enabled: "true",
  badge_authentic_text: "100% Authentic",
  feature_deals_enabled: "true",
  feature_bundles_enabled: "true",
  feature_reviews_enabled: "true",
  feature_subscribe_popup_enabled: "true",
  feature_bundle_config: '[{"count":2,"discount":10,"label":"Pick 2"},{"count":3,"discount":15,"label":"Pick 3"}]',
  copy_hero_badge: "New Collection 2026",
  copy_hero_title: "Love, bottled. Meet {store}.",
  copy_hero_tagline: "Not just a perfume. A presence.",
  copy_hero_description: "Discover premium fragrances that make every day special. Starting at just Rs. 499.",
  copy_hero_cta: "Shop Now",
  copy_footer_tagline: "Experience {store} today: A scent that stays longer than words.\nTry it. Love it. Wear it.",
  copy_subscribe_title: "Get 10% Off",
  copy_subscribe_body: "Join the {store} family and get an exclusive discount on your first order",
  copy_subscribe_promo_code: "FIRST10",
  copy_cart_empty_title: "Your Bag is Empty",
  copy_cart_empty_body: "Looks like you haven't added any fragrances yet. Let's fix that!",
  copy_deals_title: "Deals & Offers",
  copy_deals_subtitle: "Grab these exclusive deals before they're gone",
  copy_bundle_title: "Build Your Own Bundle",
  copy_bundle_subtitle: "Pick your favorite fragrances and save big. Perfect for gifting or treating yourself!",
  social_instagram_url: "",
  social_whatsapp_number: "",
  contact_address: "Mumbai, Maharashtra, India",
  contact_hours: "Monday to Saturday, 10:00 am – 6:00 pm IST",
};

/** Replace {store} placeholders in copy strings */
function interpolate(text: string, storeName: string): string {
  return text.replace(/\{store\}/g, storeName);
}

export function useSettings() {
  const { data, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000,
  });

  const tenant = useTenant();
  const settings: AppSettings = { ...DEFAULTS, ...(data as Partial<AppSettings>) };

  // Tenant table takes priority over settings table for overlapping fields
  if (tenant?.name) settings.store_name = tenant.name;
  if (tenant?.supportEmail) settings.store_email = tenant.supportEmail;
  if (tenant?.supportPhone) settings.store_phone = tenant.supportPhone;

  const numOr = (val: string, fallback: number) => {
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
  };

  const storeName = settings.store_name || "Store";

  return {
    settings,
    isLoading,
    storeName,
    // Shipping & payments (tenant admin)
    shippingFee: numOr(settings.shipping_fee, 99),
    freeShippingThreshold: numOr(settings.free_shipping_threshold, 1499),
    upiId: settings.upi_id || (import.meta.env.VITE_UPI_ID as string | undefined) || "",
    upiBusinessName: settings.upi_business_name || (import.meta.env.VITE_UPI_BUSINESS_NAME as string | undefined) || storeName,
    upiMerchantMode: settings.upi_merchant_mode === "true",
    upiMerchantCode: (settings.upi_merchant_code || "").replace(/\D/g, "").slice(0, 4) || "5999",
    storeEmail: settings.store_email,
    storePhone: settings.store_phone,
    codEnabled: settings.cod_enabled === "true",
    minOrderAmount: numOr(settings.min_order_amount, 0),
    razorpayEnabled: settings.razorpay_enabled === "true",
    // Badges
    badgeDeliveryEnabled: settings.badge_delivery_enabled !== "false",
    badgeDeliveryText: settings.badge_delivery_text || "Free Delivery ₹{amount}+",
    badgeReturnsEnabled: settings.badge_returns_enabled !== "false",
    badgeReturnsText: settings.badge_returns_text || "7-Day Returns",
    badgeAuthenticEnabled: settings.badge_authentic_enabled !== "false",
    badgeAuthenticText: settings.badge_authentic_text || "100% Authentic",
    // Feature toggles
    dealsEnabled: settings.feature_deals_enabled !== "false",
    bundlesEnabled: settings.feature_bundles_enabled !== "false",
    reviewsEnabled: settings.feature_reviews_enabled !== "false",
    subscribePopupEnabled: settings.feature_subscribe_popup_enabled !== "false",
    bundleConfig: (() => {
      try { return JSON.parse(settings.feature_bundle_config) as { count: number; discount: number; label: string }[]; }
      catch { return [{ count: 2, discount: 10, label: "Pick 2" }, { count: 3, discount: 15, label: "Pick 3" }]; }
    })(),
    // Copy (with {store} interpolation)
    copyHeroBadge: interpolate(settings.copy_hero_badge, storeName),
    copyHeroTitle: interpolate(settings.copy_hero_title, storeName),
    copyHeroTagline: interpolate(settings.copy_hero_tagline, storeName),
    copyHeroDescription: interpolate(settings.copy_hero_description, storeName),
    copyHeroCta: interpolate(settings.copy_hero_cta, storeName),
    copyFooterTagline: interpolate(settings.copy_footer_tagline, storeName),
    copySubscribeTitle: interpolate(settings.copy_subscribe_title, storeName),
    copySubscribeBody: interpolate(settings.copy_subscribe_body, storeName),
    copySubscribePromoCode: settings.copy_subscribe_promo_code || "FIRST10",
    copyCartEmptyTitle: settings.copy_cart_empty_title,
    copyCartEmptyBody: settings.copy_cart_empty_body,
    copyDealsTitle: settings.copy_deals_title,
    copyDealsSubtitle: settings.copy_deals_subtitle,
    copyBundleTitle: settings.copy_bundle_title,
    copyBundleSubtitle: settings.copy_bundle_subtitle,
    // Social
    socialInstagramUrl: settings.social_instagram_url || "",
    socialWhatsappNumber: settings.social_whatsapp_number || settings.store_phone?.replace(/\D/g, "") || "",
    // Contact
    contactAddress: settings.contact_address,
    contactHours: settings.contact_hours,
  };
}
