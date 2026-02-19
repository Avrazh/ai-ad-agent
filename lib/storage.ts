import fs from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

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
  console.log(`[storage.read] bucket=${bucket} input=${String(filenameOrUrl).slice(0, 80)}`);
  if (filenameOrUrl.startsWith("https://")) {
    const res = await fetch(filenameOrUrl);
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
