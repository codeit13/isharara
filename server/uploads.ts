import { Client } from "@replit/object-storage";

const client = new Client();
const PRODUCTS_PREFIX = "products/";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/** Sanitize product name for filename: "Velvet Rose" -> "velvet-rose" */
export function sanitizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "product";
}

export function isAllowedImage(mimetype: string, size: number): boolean {
  return ALLOWED_TYPES.includes(mimetype) && size <= MAX_SIZE_BYTES;
}

export async function uploadProductImages(
  productName: string,
  files: { buffer: Buffer; mimetype: string }[],
  startIndex = 0
): Promise<string[]> {
  const base = sanitizeProductName(productName);
  const urls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const { buffer, mimetype } = files[i];
    const ext = mimetype === "image/jpeg" ? "jpg" : mimetype === "image/png" ? "png" : "webp";
    const objectName = `${PRODUCTS_PREFIX}${base}-${startIndex + i + 1}.${ext}`;

    const { ok, error } = await client.uploadFromBytes(objectName, buffer);
    if (!ok) throw new Error(error?.message ?? `Upload failed for image ${i + 1}`);
    urls.push(`/api/uploads/${objectName}`);
  }

  return urls;
}

export async function getImageBuffer(objectName: string): Promise<Buffer | null> {
  const { ok, value } = await client.downloadAsBytes(objectName);
  if (!ok || !value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return Buffer.concat(value);
  return Buffer.from(value as ArrayBuffer);
}

export async function deleteProductImage(urlPath: string): Promise<boolean> {
  const match = urlPath.match(/^\/api\/uploads\/(products\/[a-z0-9-]+\.[a-z]+)$/);
  if (!match) return false;
  const objectName = match[1];
  const { ok } = await client.delete(objectName);
  return ok;
}
