/**
 * Shared promo discount rules — keep client cart/checkout and server order validation in sync.
 * Minimum order applies to merchandise subtotal (line items), not shipping.
 */

export interface PromoForDiscount {
  discountType: string;
  discountValue: number;
  minOrderAmount?: number | null;
}

export interface CartLineForPromo {
  price: number;
  quantity: number;
}

/**
 * @param merchandiseSubtotal - Sum of line items (pre-shipping); used for min-order check
 * @param discountBaseAmount - Amount that percentage / flat discounts apply to (e.g. items only, or items + shipping)
 * @param items - Cart lines (used for bundle / B2G1)
 */
export function computePromoDiscount(
  promo: PromoForDiscount,
  merchandiseSubtotal: number,
  discountBaseAmount: number,
  items: CartLineForPromo[],
): number {
  const min = promo.minOrderAmount ?? 0;
  if (min > 0 && merchandiseSubtotal < min) {
    return 0;
  }

  if (promo.discountType === "percentage") {
    return Math.round(discountBaseAmount * (promo.discountValue / 100));
  }
  if (promo.discountType === "flat") {
    return Math.min(promo.discountValue, discountBaseAmount);
  }
  if (promo.discountType === "bundle") {
    const unitPrices = items.flatMap((i) => Array.from({ length: i.quantity }, () => i.price));
    unitPrices.sort((a, b) => a - b);
    const freeCount = Math.floor(unitPrices.length / 3);
    return unitPrices.slice(0, freeCount).reduce((sum, p) => sum + p, 0);
  }
  return 0;
}
