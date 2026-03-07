export interface UpiParams {
  amount: number;       // in rupees (e.g. 499)
  orderId: string | number;
  note?: string;
  /** Override from DB settings; falls back to VITE_UPI_ID env var */
  upiId?: string;
  /** Override from DB settings; falls back to VITE_UPI_BUSINESS_NAME env var */
  businessName?: string;
  /** When true: add mc + mode=02 (merchant). When false: mode=01, omit mc (personal P2P). */
  merchantMode?: boolean;
  /** 4-digit MCC for merchant mode only; e.g. 5999, 5411 */
  merchantCode?: string;
}

/** Returns the transaction note (tn) used in UPI intent URLs. Export for UI display. */
export function getUpiNote(orderId: string | number): string {
  return `Payment for ${orderId}`;
}

/** Build the standard UPI payment URI (used for deep links and QR codes). */
export function buildUpiUrl(params: UpiParams): string {
  const upiId = params.upiId || (import.meta.env.VITE_UPI_ID as string | undefined) || "";
  const name  = params.businessName || (import.meta.env.VITE_UPI_BUSINESS_NAME as string | undefined) || "ISHQARA";

  if (!upiId) return "";

  const note = params.note ?? getUpiNote(params.orderId); // tn = transaction note in UPI
  const isMerchant = params.merchantMode === true;
  const mc = (params.merchantCode || "5999").replace(/\D/g, "").slice(0, 4) || "5999";

  // URLSearchParams encodes spaces as '+'; UPI apps expect '%20' — use manual encoding
  // Merchant: mc + mode=02. Personal: mode=01, omit mc.
  const parts = [
    `pa=${encodeURIComponent(upiId)}`,
    `pn=${encodeURIComponent(name)}`,
    `am=${params.amount.toFixed(2)}`,
    `cu=INR`,
    `tr=${encodeURIComponent(`ISHQARA-${params.orderId}`)}`,
    `tn=${encodeURIComponent(note)}`,
    `mode=${isMerchant ? "02" : "01"}`,
  ];
  if (isMerchant) parts.push(`mc=${encodeURIComponent(mc)}`);

  return `upi://pay?${parts.join("&")}`;
}

/**
 * Same URI but safe to embed in a QR code.
 * All UPI apps (PhonePe, GPay, Paytm, BHIM) can scan upi://pay?... directly.
 */
export function buildUpiQrValue(params: UpiParams): string {
  return buildUpiUrl(params);
}

/**
 * Per-app URI for iOS — each app uses a different format and exact keys.
 * Safari does not support generic upi://, so we use app-specific schemes.
 */
export function buildAppUpiUrls(params: UpiParams): {
  label: string;
  icon: string;
  url: string;
}[] {
  const upiId = params.upiId || (import.meta.env.VITE_UPI_ID as string | undefined) || "";
  const name = params.businessName || (import.meta.env.VITE_UPI_BUSINESS_NAME as string | undefined) || "ISHQARA";
  if (!upiId) return [];

  const note = params.note ?? getUpiNote(params.orderId);
  const tr = `ISHQARA-${params.orderId}`;
  const am = params.amount.toFixed(2);
  const mc = (params.merchantCode || "5411").replace(/\D/g, "").slice(0, 4) || "5411";

  const pa = encodeURIComponent(upiId);
  const pn = encodeURIComponent(name);
  const tn = encodeURIComponent(note);
  const trEnc = encodeURIComponent(tr);

  // GPay: gpay://upi/pay?pa=&pn=&tr=&tn=&am=&cu=INR&mc=
  const gpayUri = `gpay://upi/pay?pa=${pa}&pn=${pn}&tr=${trEnc}&tn=${tn}&am=${am}&cu=INR&mc=${mc}`;

  // Paytm: paytmmp://pay?pa=&pn=&tr=&tn=&am=&cu=INR&mc=
  const paytmUri = `paytmmp://pay?pa=${pa}&pn=${pn}&tr=${trEnc}&tn=${tn}&am=${am}&cu=INR&mc=${mc}`;

  // PhonePe: phonepe://pay?pa=&pn=&mc=NA&tr=&tn=&am=&mam=&cu=INR
  const phonepeUri = `phonepe://pay?pa=${pa}&pn=${pn}&mc=NA&tr=${trEnc}&tn=${tn}&am=${am}&mam=${am}&cu=INR`;

  // All apps: upi://pay?pa=&pn=&mc=NA&tr=&tn=&am=&mam=&cu=INR
  const allAppsUri = `upi://pay?pa=${pa}&pn=${pn}&mc=NA&tr=${trEnc}&tn=${tn}&am=${am}&mam=${am}&cu=INR`;

  return [
    {
      label: "All apps",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/UPI-Logo.png/200px-UPI-Logo.png",
      url: allAppsUri,
    },
    {
      label: "Google Pay",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/1200px-Google_Pay_Logo.svg.png",
      url: gpayUri,
    },
    {
      label: "Paytm",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/1200px-Paytm_Logo_%28standalone%29.svg.png",
      url: paytmUri,
    },
    {
      label: "PhonePe",
      icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/PhonePe_Logo.svg/1200px-PhonePe_Logo.svg.png",
      url: phonepeUri,
    },
    {
      label: "Cred",
      icon: "https://upload.wikimedia.org/wikipedia/commons/9/9d/CRED-LOGO2.png",
      url: `credupipay://pay?pa=${pa}&pn=${pn}&tr=${trEnc}&tn=${tn}&am=${am}&cu=INR&mc=${mc}`,
    },
    {
      label: "BHIM",
      icon: "https://upload.wikimedia.org/wikipedia/commons/9/90/Bhim-logo.png",
      url: `bhim://pay?pa=${pa}&pn=${pn}&mc=NA&tr=${trEnc}&tn=${tn}&am=${am}&mam=${am}&cu=INR`,
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
