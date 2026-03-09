const PRODUCTS_PREFIX = "products/";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/** Cloudinary configured? Use as fallback when Replit fails */
function isCloudinaryConfigured(): boolean {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

/** Upload to Cloudinary (fallback when Replit unavailable) */
async function uploadToCloudinary(buffer: Buffer, mimetype: string, publicId: string, folder = "ishqara/products"): Promise<string> {
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const dataUri = `data:${mimetype};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    folder,
  });
  return result.secure_url;
}

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

/** Upload a tenant logo — returns public URL */
export async function uploadLogo(buffer: Buffer, mimetype: string, tenantSlug: string): Promise<string> {
  const ext = mimetype === "image/jpeg" ? "jpg" : mimetype === "image/png" ? "png" : "webp";
  const objectName = `${tenantSlug}/logo.${ext}`;
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(buffer, mimetype, `${tenantSlug}/logo`, `${tenantSlug}`);
  }
  try {
    const client = await getClient();
    const { ok, error } = await client.uploadFromBytes(objectName, buffer);
    if (!ok) throw new Error(error?.message ?? "Upload failed");
    return `/api/uploads/${objectName}`;
  } catch {
    throw new Error("Add Cloudinary credentials (CLOUDINARY_*) or use Replit Object Storage.");
  }
}

/** Upload a single image (for Add/Edit modal) — returns public URL */
export async function uploadSingleImage(buffer: Buffer, mimetype: string, tenantSlug?: string): Promise<string> {
  const ext = mimetype === "image/jpeg" ? "jpg" : mimetype === "image/png" ? "png" : "webp";
  const prefix = tenantSlug ? `${tenantSlug}/products/` : PRODUCTS_PREFIX;
  const objectName = `${prefix}${randomUUID()}.${ext}`;
  if (isCloudinaryConfigured()) {
    const folder = tenantSlug ? `${tenantSlug}/products` : "ishqara/products";
    return uploadToCloudinary(buffer, mimetype, objectName.replace(/\.[^.]+$/, ""), folder);
  }
  try {
    const client = await getClient();
    const { ok, error } = await client.uploadFromBytes(objectName, buffer);
    if (!ok) throw new Error(error?.message ?? "Upload failed");
    return `/api/uploads/${objectName}`;
  } catch {
    throw new Error("Add Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) or use /images/ paths.");
  }
}

/** Upload image with filename = object name (for bulk upload by product name) */
export async function uploadImageByFilename(
  buffer: Buffer,
  mimetype: string,
  originalFilename: string,
  tenantSlug?: string
): Promise<string> {
  const base = originalFilename.replace(/\.[^.]+$/, "");
  const sanitized = sanitizeProductName(base);
  const ext = mimetype === "image/jpeg" ? "jpg" : mimetype === "image/png" ? "png" : "webp";
  const prefix = tenantSlug ? `${tenantSlug}/products/` : PRODUCTS_PREFIX;
  const objectName = `${prefix}${sanitized}.${ext}`;
  if (isCloudinaryConfigured()) {
    const folder = tenantSlug ? `${tenantSlug}/products` : "ishqara/products";
    return uploadToCloudinary(buffer, mimetype, `${folder}/${sanitized}`, folder);
  }
  try {
    const client = await getClient();
    const { ok, error } = await client.uploadFromBytes(objectName, buffer);
    if (!ok) throw new Error(error?.message ?? "Upload failed");
    return `/api/uploads/${objectName}`;
  } catch {
    throw new Error("Add Cloudinary credentials (CLOUDINARY_*) or use /images/ paths.");
  }
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
