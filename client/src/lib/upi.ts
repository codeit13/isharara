export interface UpiParams {
  amount: number;       // in rupees (e.g. 499)
  orderId: string | number;
  note?: string;
}

/**
 * Branded UPI transaction notes — each ≤ 80 chars (NPCI limit).
 * Rotated deterministically by order ID so the same order always sees the same note.
 */
const BRANDED_NOTES = [
  "Your signature scent is on its way — ISHQARA",
  "Crafted for those who wear their mood — ISHQARA",
  "Luxury fragrance, delivered with love — ISHQARA",
  "One spritz to remember — ISHQARA",
  "You just made the room more interesting — ISHQARA",
  "Fragrance that tells your story — ISHQARA",
  "Bold. Elegant. Unapologetically you — ISHQARA",
  "Your next obsession, sealed with a scent — ISHQARA",
];

function getBrandedNote(orderId: string | number): string {
  const idx = Number(orderId) % BRANDED_NOTES.length;
  return BRANDED_NOTES[Math.abs(idx)];
}

/** Build the standard UPI payment URI (used for deep links and QR codes). */
export function buildUpiUrl(params: UpiParams): string {
  const upiId = import.meta.env.VITE_UPI_ID as string | undefined;
  const name  = (import.meta.env.VITE_UPI_BUSINESS_NAME as string | undefined) ?? "ISHQARA";

  if (!upiId) return "";

  const note = params.note ?? getBrandedNote(params.orderId);

  // URLSearchParams encodes spaces as '+'; UPI apps expect '%20' — use manual encoding
  const parts = [
    `pa=${encodeURIComponent(upiId)}`,
    `pn=${encodeURIComponent(name)}`,
    `am=${params.amount.toFixed(2)}`,
    `cu=INR`,
    `tr=${encodeURIComponent(`ISHQARA-${params.orderId}`)}`,
    `tn=${encodeURIComponent(note)}`,
  ];

  return `upi://pay?${parts.join("&")}`;
}

/**
 * Same URI but safe to embed in a QR code.
 * All UPI apps (PhonePe, GPay, Paytm, BHIM) can scan upi://pay?... directly.
 */
export function buildUpiQrValue(params: UpiParams): string {
  return buildUpiUrl(params);
}

/** Per-app URI for iOS (Safari does not support generic upi://) */
export function buildAppUpiUrls(params: UpiParams): {
  label: string;
  icon: string;
  url: string;
}[] {
  const base = buildUpiUrl(params);
  if (!base) return [];

  // Strip the "upi://pay?" prefix and use the raw query string
  const qs = base.replace("upi://pay?", "");

  return [
    {
      label: "PhonePe",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/PhonePe_Logo.svg/1200px-PhonePe_Logo.svg.png",
      url: `phonepe://pay?${qs}`,
    },
    {
      label: "Google Pay",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/1200px-Google_Pay_Logo.svg.png",
      url: `gpay://upi/pay?${qs}`,
    },
    {
      label: "Paytm",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/1200px-Paytm_Logo_%28standalone%29.svg.png",
      url: `paytmmp://pay?${qs}`,
    },
    {
      label: "BHIM",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/BHIM_logo.png/240px-BHIM_logo.png",
      url: `bhim://pay?${qs}`,
    },
  ];
}

export type DeviceType = "android" | "ios" | "desktop";

export function detectDevice(): DeviceType {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Attempt to open UPI intent on Android.
 * Returns true if upi:// scheme was attempted.
 */
export function triggerAndroidUpi(url: string): boolean {
  if (!url) return false;
  window.location.href = url;
  return true;
}

/** Try to open a specific UPI app URL. Returns false immediately so the caller
 *  can show a timeout/fallback without blocking. */
export function openUpiApp(url: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);
  // Using iframe avoids navigation — app opens if installed, otherwise nothing happens
  try {
    iframe.src = url;
  } finally {
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }
}
