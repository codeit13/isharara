/**
 * Load Razorpay checkout script and return the Razorpay constructor when ready.
 */
export function loadRazorpay(): Promise<typeof window.Razorpay> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay only runs in browser"));
  }
  if ((window as any).Razorpay) {
    return Promise.resolve((window as any).Razorpay);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).Razorpay) {
        resolve((window as any).Razorpay);
      } else {
        reject(new Error("Razorpay failed to load"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.body.appendChild(script);
  });
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  order_id: string;
  name?: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: { ondismiss?: () => void };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayInstance {
  open(): void;
  on(event: string, handler: () => void): void;
}
