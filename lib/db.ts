import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL env var is required");
    _client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

let _migrationDone: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
  if (!_migrationDone) {
    _migrationDone = migrate();
  }
  return _migrationDone;
}

async function migrate(): Promise<void> {
  const client = getClient();
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS images (
        id         TEXT PRIMARY KEY,
        filename   TEXT NOT NULL,
        url        TEXT NOT NULL,
        width      INTEGER NOT NULL,
        height     INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS safe_zones (
        image_id TEXT PRIMARY KEY,
        data     TEXT NOT NULL,
        FOREIGN KEY (image_id) REFERENCES images(id)
      )`,
      `CREATE TABLE IF NOT EXISTS copy_pools (
        image_id TEXT PRIMARY KEY,
        data     TEXT NOT NULL,
        FOREIGN KEY (image_id) REFERENCES images(id)
      )`,
      `CREATE TABLE IF NOT EXISTS ad_specs (
        id         TEXT PRIMARY KEY,
        image_id   TEXT NOT NULL,
        data       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (image_id) REFERENCES images(id)
      )`,
      `CREATE TABLE IF NOT EXISTS render_results (
        id          TEXT PRIMARY KEY,
        ad_spec_id  TEXT NOT NULL,
        image_id    TEXT NOT NULL,
        family_id   TEXT NOT NULL DEFAULT '',
        template_id TEXT NOT NULL,
        headline_id TEXT NOT NULL,
        png_url     TEXT NOT NULL,
        approved    INTEGER NOT NULL DEFAULT 0,
        replaced_by TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ad_spec_id) REFERENCES ad_specs(id),
        FOREIGN KEY (image_id)   REFERENCES images(id)
      )`,
    ],
    "write"
  );

  // Additive migration: add family_id if it doesn't exist yet
  try {
    await client.execute(
      `ALTER TABLE render_results ADD COLUMN family_id TEXT NOT NULL DEFAULT ''`
    );
  } catch {
    // Column already exists — ignore
  }
}

// ── Image queries ───────────────────────────────────────────
export async function insertImage(row: {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
}) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT INTO images (id, filename, url, width, height) VALUES (?, ?, ?, ?, ?)`,
    args: [row.id, row.filename, row.url, row.width, row.height],
  });
}

export async function getImage(id: string) {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM images WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    filename: row.filename as string,
    url: row.url as string,
    width: row.width as number,
    height: row.height as number,
    created_at: row.created_at as string,
  };
}

export async function getAllImages() {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(
    `SELECT * FROM images ORDER BY created_at DESC`
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    filename: row.filename as string,
    url: row.url as string,
    width: row.width as number,
    height: row.height as number,
    created_at: row.created_at as string,
  }));
}

// ── SafeZones queries ───────────────────────────────────────
export async function upsertSafeZones(imageId: string, data: string) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT OR REPLACE INTO safe_zones (image_id, data) VALUES (?, ?)`,
    args: [imageId, data],
  });
}

export async function getSafeZones(imageId: string): Promise<string | undefined> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT data FROM safe_zones WHERE image_id = ?`,
    args: [imageId],
  });
  const row = result.rows[0];
  return row ? (row.data as string) : undefined;
}

// ── CopyPool queries ────────────────────────────────────────
export async function upsertCopyPool(imageId: string, data: string) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT OR REPLACE INTO copy_pools (image_id, data) VALUES (?, ?)`,
    args: [imageId, data],
  });
}

export async function getCopyPool(imageId: string): Promise<string | undefined> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT data FROM copy_pools WHERE image_id = ?`,
    args: [imageId],
  });
  const row = result.rows[0];
  return row ? (row.data as string) : undefined;
}

// ── AdSpec queries ──────────────────────────────────────────
export async function insertAdSpec(id: string, imageId: string, data: string) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT INTO ad_specs (id, image_id, data) VALUES (?, ?, ?)`,
    args: [id, imageId, data],
  });
}

export async function getAdSpec(id: string) {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM ad_specs WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    image_id: row.image_id as string,
    data: row.data as string,
    created_at: row.created_at as string,
  };
}

// ── RenderResult queries ────────────────────────────────────
export async function insertRenderResult(row: {
  id: string;
  adSpecId: string;
  imageId: string;
  familyId: string;
  templateId: string;
  primarySlotId: string;
  pngUrl: string;
}) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT INTO render_results (id, ad_spec_id, image_id, family_id, template_id, headline_id, png_url)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.id,
      row.adSpecId,
      row.imageId,
      row.familyId,
      row.templateId,
      row.primarySlotId,
      row.pngUrl,
    ],
  });
}

export async function getRenderResult(id: string) {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM render_results WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    ad_spec_id: row.ad_spec_id as string,
    image_id: row.image_id as string,
    family_id: row.family_id as string,
    template_id: row.template_id as string,
    headline_id: row.headline_id as string,
    png_url: row.png_url as string,
    approved: row.approved as number,
    replaced_by: row.replaced_by as string | null,
    created_at: row.created_at as string,
  };
}

export async function getActiveResults(imageId: string) {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM render_results WHERE image_id = ? AND replaced_by IS NULL ORDER BY created_at DESC`,
    args: [imageId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    ad_spec_id: row.ad_spec_id as string,
    image_id: row.image_id as string,
    template_id: row.template_id as string,
    headline_id: row.headline_id as string,
    png_url: row.png_url as string,
    approved: row.approved as number,
    replaced_by: row.replaced_by as string | null,
    created_at: row.created_at as string,
  }));
}

export async function setApproval(resultId: string, approved: boolean) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `UPDATE render_results SET approved = ? WHERE id = ?`,
    args: [approved ? 1 : 0, resultId],
  });
}

export async function markReplaced(oldResultId: string, newResultId: string) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `UPDATE render_results SET replaced_by = ? WHERE id = ?`,
    args: [newResultId, oldResultId],
  });
}

export async function clearAll() {
  await ensureMigrated();
  const client = getClient();
  await client.batch(
    [
      `DELETE FROM render_results`,
      `DELETE FROM ad_specs`,
      `DELETE FROM copy_pools`,
      `DELETE FROM safe_zones`,
      `DELETE FROM images`,
    ],
    "write"
  );
}
