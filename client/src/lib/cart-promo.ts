import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/lib/cart";
import type { Promotion } from "@shared/schema";

const PROMO_KEY = "ishqara_cart_promo";

function getStoredPromo(): Promotion | null {
  try {
    const data = localStorage.getItem(PROMO_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function savePromo(promo: Promotion | null) {
  if (promo) {
    localStorage.setItem(PROMO_KEY, JSON.stringify(promo));
  } else {
    localStorage.removeItem(PROMO_KEY);
  }
  window.dispatchEvent(new Event("cart-promo-updated"));
}

export function useCartPromo() {
  const { items, totalPrice, clearCart } = useCart();
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(getStoredPromo);

  const { data: promotions } = useQuery<Promotion[]>({ queryKey: ["/api/promotions"] });

  useEffect(() => {
    const handler = () => setAppliedPromo(getStoredPromo());
    window.addEventListener("cart-promo-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cart-promo-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Clear promo when cart is empty
  useEffect(() => {
    if (items.length === 0 && appliedPromo) {
      setAppliedPromo(null);
      savePromo(null);
    }
  }, [items.length, appliedPromo]);

  const getDiscountAmount = useCallback((baseAmount: number = totalPrice) => {
    if (!appliedPromo || !appliedPromo.isActive) return 0;
    if (appliedPromo.discountType === "percentage") {
      return Math.round(baseAmount * (appliedPromo.discountValue / 100));
    }
    if (appliedPromo.discountType === "flat") {
      return Math.min(appliedPromo.discountValue, baseAmount);
    }
    if (appliedPromo.discountType === "bundle") {
      const unitPrices = items.flatMap((i) => Array(i.quantity).fill(i.price));
      unitPrices.sort((a, b) => a - b);
      const freeCount = Math.floor(unitPrices.length / 3);
      return unitPrices.slice(0, freeCount).reduce((sum, p) => sum + p, 0);
    }
    return 0;
  }, [appliedPromo, totalPrice, items]);

  const discountAmount = getDiscountAmount(totalPrice);

  const applyPromo = useCallback(async (code: string, email?: string) => {
    const trimmed = code.trim();
    if (!trimmed) return { success: false, reason: "Enter a code" };
    try {
      const res = await fetch("/api/checkout/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: trimmed, email: email || undefined }),
      });
      const data = await res.json();
      if (data.valid && data.promo) {
        setAppliedPromo(data.promo);
        savePromo(data.promo);
        return { success: true };
      }
      return { success: false, reason: data.reason || "Invalid or expired code" };
    } catch {
      return { success: false, reason: "Invalid or expired code" };
    }
  }, []);

  const removePromo = useCallback(() => {
    setAppliedPromo(null);
    savePromo(null);
  }, []);

  const getPromoEffectText = (p: Promotion): string => {
    if (p.discountType === "percentage") return `${p.discountValue}% off your order`;
    if (p.discountType === "flat") return `Rs. ${p.discountValue} off your order`;
    if (p.discountType === "bundle") return "Buy 2 Get 1 Free — cheapest item free per 3 items";
    return "";
  };

  /** For bundle promos: how many more items needed to unlock (0 = already unlocked) */
  const bundleItemsNeeded = (() => {
    if (!appliedPromo || appliedPromo.discountType !== "bundle") return 0;
    const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
    const minForDiscount = 3; // B2G1: need 3 items
    if (totalUnits >= minForDiscount) return 0;
    return minForDiscount - totalUnits;
  })();

  return {
    appliedPromo,
    discountAmount,
    getDiscountAmount,
    applyPromo,
    removePromo,
    getPromoEffectText,
    bundleItemsNeeded,
    hasPromoCodes: !!(promotions?.some((p) => p.isActive && p.code)),
  };
}
