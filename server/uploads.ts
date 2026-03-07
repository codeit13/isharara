const PRODUCTS_PREFIX = "products/";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/** Lazy Replit client — only connects when used; fails gracefully when running locally */
let _client: import("@replit/object-storage").Client | null = null;
let _clientError: Error | null = null;

async function getClient(): Promise<import("@replit/object-storage").Client> {
  if (_clientError) throw _clientError;
  if (_client) return _client;
  try {
    const { Client } = await import("@replit/object-storage");
    const bucketId = process.env.REPLIT_OBJECT_STORAGE_BUCKET;
    _client = new Client(bucketId ? { bucketId } : undefined);
    return _client;
  } catch (e) {
    _clientError = e instanceof Error ? e : new Error(String(e));
    throw new Error("Replit Object Storage is only available on Replit. Run locally with /images/... paths.");
  }
}

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

/** Upload a single image (for Add/Edit modal) — returns public URL */
export async function uploadSingleImage(buffer: Buffer, mimetype: string): Promise<string> {
  const client = await getClient();
  const ext = mimetype === "image/jpeg" ? "jpg" : mimetype === "image/png" ? "png" : "webp";
  const objectName = `${PRODUCTS_PREFIX}${randomUUID()}.${ext}`;
  const { ok, error } = await client.uploadFromBytes(objectName, buffer);
  if (!ok) throw new Error(error?.message ?? "Upload failed");
  return `/api/uploads/${objectName}`;
}

/** Upload image with filename = object name (for bulk upload by product name) */
export async function uploadImageByFilename(
  buffer: Buffer,
  mimetype: string,
  originalFilename: string
): Promise<string> {
  const client = await getClient();
  const base = originalFilename.replace(/\.[^.]+$/, ""); // strip extension
  const sanitized = sanitizeProductName(base);
  const ext = mimetype === "image/jpeg" ? "jpg" : mimetype === "image/png" ? "png" : "webp";
  const objectName = `${PRODUCTS_PREFIX}${sanitized}.${ext}`;
  const { ok, error } = await client.uploadFromBytes(objectName, buffer);
  if (!ok) throw new Error(error?.message ?? "Upload failed");
  return `/api/uploads/${objectName}`;
}

function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getImageBuffer(objectName: string): Promise<Buffer | null> {
  try {
    const client = await getClient();
    const { ok, value } = await client.downloadAsBytes(objectName);
    if (!ok || !value) return null;
    if (Buffer.isBuffer(value)) return value;
    if (Array.isArray(value)) return Buffer.concat(value);
    return Buffer.from(value as ArrayBuffer);
  } catch {
    return null;
  }
}

export async function deleteProductImage(urlPath: string): Promise<boolean> {
  const match = urlPath.match(/^\/api\/uploads\/(products\/[a-z0-9-]+\.[a-z]+)$/);
  if (!match) return false;
  try {
    const client = await getClient();
    const { ok } = await client.delete(match[1]);
    return ok;
  } catch {
    return false;
  }
}
