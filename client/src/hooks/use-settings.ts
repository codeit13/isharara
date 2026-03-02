import { useQuery } from "@tanstack/react-query";

export type AppSettings = {
  shipping_fee: string;
  free_shipping_threshold: string;
  store_name: string;
  store_email: string;
  store_phone: string;
  upi_id: string;
  upi_business_name: string;
  cod_enabled: string;
  min_order_amount: string;
};

const DEFAULTS: AppSettings = {
  shipping_fee: "99",
  free_shipping_threshold: "1499",
  store_name: "ISHQARA",
  store_email: "ishqaraperfumes@gmail.com",
  store_phone: "+91 98679 02305",
  upi_id: "",
  upi_business_name: "ISHQARA",
  cod_enabled: "false",
  min_order_amount: "0",
};

export function useSettings() {
  const { data, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000, // cache for 5 min — settings rarely change
  });

  const settings: AppSettings = { ...DEFAULTS, ...(data as Partial<AppSettings>) };

  return {
    settings,
    isLoading,
    shippingFee: Number(settings.shipping_fee) || 99,
    freeShippingThreshold: Number(settings.free_shipping_threshold) || 1499,
    upiId: settings.upi_id || (import.meta.env.VITE_UPI_ID as string | undefined) || "",
    upiBusinessName: settings.upi_business_name || (import.meta.env.VITE_UPI_BUSINESS_NAME as string | undefined) || "ISHQARA",
    storeName: settings.store_name || "ISHQARA",
    storeEmail: settings.store_email,
    storePhone: settings.store_phone,
    codEnabled: settings.cod_enabled === "true",
    minOrderAmount: Number(settings.min_order_amount) || 0,
  };
}
