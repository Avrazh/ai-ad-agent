import fs from "fs/promises";
import path from "path";
import { put, del, list } from "@vercel/blob";

type Bucket = "uploads" | "generated";

// /tmp is the only writable directory on Vercel; local dev uses project/storage
const STORAGE_ROOT = process.env.NODE_ENV === "production"
  ? "/tmp"
  : path.join(process.cwd(), "storage");

// Use Vercel Blob when the token is present (upgrades /tmp to persistent CDN storage)
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

function bucketPath(bucket: Bucket): string {
  return path.join(STORAGE_ROOT, bucket);
}

function filePath(bucket: Bucket, filename: string): string {
  return path.join(bucketPath(bucket), filename);
}

export async function save(bucket: Bucket, id: string, buffer: Buffer): Promise<string> {
  if (USE_BLOB) {
    const { url } = await put(`${bucket}/${id}`, buffer, {
      access: "public",
      addRandomSuffix: false,
    });
    return url; // returns the Vercel Blob CDN URL
  }

  // Local filesystem fallback
  const dir = bucketPath(bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath(bucket, id), buffer);
  return getUrl(bucket, id);
}

// Accepts either a bare filename (local mode) or a full https:// blob URL
export async function read(bucket: Bucket, filenameOrUrl: string): Promise<Buffer> {
  if (filenameOrUrl.startsWith("https://")) {
    const headers: HeadersInit = {};
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
    }
    const res = await fetch(filenameOrUrl, { headers });
    if (!res.ok) throw new Error(`Blob fetch failed with status ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // Local: strip the /api/files/… prefix if present, keep just the filename
  const filename = filenameOrUrl.includes("/") ? path.basename(filenameOrUrl) : filenameOrUrl;
  return fs.readFile(filePath(bucket, filename));
}

export async function exists(bucket: Bucket, id: string): Promise<boolean> {
  if (id.startsWith("https://")) return true; // blob URLs always assumed to exist
  try {
    await fs.access(filePath(bucket, id));
    return true;
  } catch {
    return false;
  }
}

// Returns a local serve URL (only used in local/dev mode)
export function getUrl(bucket: Bucket, id: string): string {
  return `/api/files/${bucket}/${id}`;
}

// Delete all generated PNGs from Blob (call when a new image is uploaded)
export async function removeGenerated(): Promise<void> {
  if (!USE_BLOB) return;
  const { blobs } = await list({ prefix: "generated/" });
  if (blobs.length > 0) await del(blobs.map((b) => b.url));
}

// Delete a single blob URL (e.g. old uploaded image)
export async function removeBlobUrl(url: string): Promise<void> {
  if (!USE_BLOB || !url.startsWith("https://")) return;
  await del(url);
}

// Delete a file by its stored URL — works for both Blob CDN and local filesystem.
// Local URLs have the form /api/files/<bucket>/<filename>.
export async function removeByUrl(url: string): Promise<void> {
  if (!url) return;
  if (USE_BLOB) {
    if (url.startsWith("https://")) await del(url);
    return;
  }
  // Local fallback: extract bucket + filename from /api/files/<bucket>/<filename>
  const match = url.match(/^\/api\/files\/(uploads|generated)\/(.+)$/);
  if (!match) return;
  const [, bucket, filename] = match;
  try {
    await fs.unlink(filePath(bucket as Bucket, filename));
  } catch {
    // File may already be gone — ignore
  }
}
