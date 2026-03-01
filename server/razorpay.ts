import Razorpay from "razorpay";
import crypto from "crypto";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export function isRazorpayConfigured(): boolean {
  return !!(keyId && keySecret);
}

let instance: Razorpay | null = null;

export function getRazorpayInstance(): Razorpay {
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  if (!instance) {
    instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return instance;
}

export function getRazorpayKeyId(): string {
  if (!keyId) throw new Error("RAZORPAY_KEY_ID is not set");
  return keyId;
}

/** Amount in paise (INR * 100). Receipt is our order id for reference. */
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<{ id: string }> {
  const rzp = getRazorpayInstance();
  const order = await rzp.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
  });
  return { id: order.id };
}

/**
 * Verify payment signature from Razorpay Checkout.
 * @param razorpayOrderId - order_id from Razorpay
 * @param razorpayPaymentId - razorpay_payment_id from checkout response
 * @param signature - razorpay_signature from checkout response
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean {
  if (!keySecret) return false;
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
  return expected === signature;
}
