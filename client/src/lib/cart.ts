import { useState, useEffect, useCallback } from "react";
import type { CartItem } from "@shared/schema";

const CART_KEY = "ishqara_cart";

function getCart(): CartItem[] {
  try {
    const data = localStorage.getItem(CART_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(getCart);

  useEffect(() => {
    const handler = () => setItems(getCart());
    window.addEventListener("cart-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cart-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    const current = getCart();
    const existing = current.find(
      (i) => i.productId === item.productId && i.size === item.size
    );
    if (existing) {
      existing.quantity += 1;
    } else {
      current.push({ ...item, quantity: 1 });
    }
    saveCart(current);
  }, []);

  const removeItem = useCallback((productId: number, size: string) => {
    const current = getCart().filter(
      (i) => !(i.productId === productId && i.size === size)
    );
    saveCart(current);
  }, []);

  const updateQuantity = useCallback(
    (productId: number, size: string, quantity: number) => {
      const current = getCart();
      const item = current.find(
        (i) => i.productId === productId && i.size === size
      );
      if (item) {
        if (quantity <= 0) {
          saveCart(current.filter((i) => i !== item));
        } else {
          item.quantity = quantity;
          saveCart(current);
        }
      }
    },
    []
  );

  const clearCart = useCallback(() => {
    saveCart([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice };
}
