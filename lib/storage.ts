import fs from "fs/promises";
import path from "path";

type Bucket = "uploads" | "generated";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

function bucketPath(bucket: Bucket): string {
  return path.join(STORAGE_ROOT, bucket);
}

function filePath(bucket: Bucket, id: string): string {
  return path.join(bucketPath(bucket), id);
}

export async function save(bucket: Bucket, id: string, buffer: Buffer): Promise<string> {
  const dir = bucketPath(bucket);
  await fs.mkdir(dir, { recursive: true });
  const fp = filePath(bucket, id);
  await fs.writeFile(fp, buffer);
  return getUrl(bucket, id);
}

export async function read(bucket: Bucket, id: string): Promise<Buffer> {
  const fp = filePath(bucket, id);
  return fs.readFile(fp);
}

export async function exists(bucket: Bucket, id: string): Promise<boolean> {
  try {
    await fs.access(filePath(bucket, id));
    return true;
  } catch {
    return false;
  }
}

// MVP: serve through API route. Production: swap to CDN/presigned URL.
export function getUrl(bucket: Bucket, id: string): string {
  return `/api/files/${bucket}/${id}`;
}
