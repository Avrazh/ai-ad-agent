import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "storage", "app.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id         TEXT PRIMARY KEY,
      filename   TEXT NOT NULL,
      url        TEXT NOT NULL,
      width      INTEGER NOT NULL,
      height     INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS safe_zones (
      image_id TEXT PRIMARY KEY,
      data     TEXT NOT NULL,
      FOREIGN KEY (image_id) REFERENCES images(id)
    );

    CREATE TABLE IF NOT EXISTS copy_pools (
      image_id TEXT PRIMARY KEY,
      data     TEXT NOT NULL,
      FOREIGN KEY (image_id) REFERENCES images(id)
    );

    CREATE TABLE IF NOT EXISTS ad_specs (
      id         TEXT PRIMARY KEY,
      image_id   TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (image_id) REFERENCES images(id)
    );

    CREATE TABLE IF NOT EXISTS render_results (
      id          TEXT PRIMARY KEY,
      ad_spec_id  TEXT NOT NULL,
      image_id    TEXT NOT NULL,
      template_id TEXT NOT NULL,
      headline_id TEXT NOT NULL,
      png_url     TEXT NOT NULL,
      approved    INTEGER NOT NULL DEFAULT 0,
      replaced_by TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ad_spec_id) REFERENCES ad_specs(id),
      FOREIGN KEY (image_id)   REFERENCES images(id)
    );
  `);
}

// ── Image queries ───────────────────────────────────────────
export function insertImage(row: {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO images (id, filename, url, width, height) VALUES (?, ?, ?, ?, ?)`
  ).run(row.id, row.filename, row.url, row.width, row.height);
}

export function getImage(id: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM images WHERE id = ?`).get(id) as
    | { id: string; filename: string; url: string; width: number; height: number; created_at: string }
    | undefined;
}

export function getAllImages() {
  const db = getDb();
  return db.prepare(`SELECT * FROM images ORDER BY created_at DESC`).all() as {
    id: string;
    filename: string;
    url: string;
    width: number;
    height: number;
    created_at: string;
  }[];
}

// ── SafeZones queries ───────────────────────────────────────
export function upsertSafeZones(imageId: string, data: string) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO safe_zones (image_id, data) VALUES (?, ?)`
  ).run(imageId, data);
}

export function getSafeZones(imageId: string): string | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM safe_zones WHERE image_id = ?`).get(imageId) as
    | { data: string }
    | undefined;
  return row?.data;
}

// ── CopyPool queries ────────────────────────────────────────
export function upsertCopyPool(imageId: string, data: string) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO copy_pools (image_id, data) VALUES (?, ?)`
  ).run(imageId, data);
}

export function getCopyPool(imageId: string): string | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM copy_pools WHERE image_id = ?`).get(imageId) as
    | { data: string }
    | undefined;
  return row?.data;
}

// ── AdSpec queries ──────────────────────────────────────────
export function insertAdSpec(id: string, imageId: string, data: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO ad_specs (id, image_id, data) VALUES (?, ?, ?)`
  ).run(id, imageId, data);
}

export function getAdSpec(id: string) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM ad_specs WHERE id = ?`).get(id) as
    | { id: string; image_id: string; data: string; created_at: string }
    | undefined;
  return row;
}

// ── RenderResult queries ────────────────────────────────────
export function insertRenderResult(row: {
  id: string;
  adSpecId: string;
  imageId: string;
  templateId: string;
  headlineId: string;
  pngUrl: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO render_results (id, ad_spec_id, image_id, template_id, headline_id, png_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.adSpecId, row.imageId, row.templateId, row.headlineId, row.pngUrl);
}

export function getRenderResult(id: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM render_results WHERE id = ?`).get(id) as
    | {
        id: string;
        ad_spec_id: string;
        image_id: string;
        template_id: string;
        headline_id: string;
        png_url: string;
        approved: number;
        replaced_by: string | null;
        created_at: string;
      }
    | undefined;
}

export function getActiveResults(imageId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM render_results WHERE image_id = ? AND replaced_by IS NULL ORDER BY created_at DESC`
    )
    .all(imageId) as {
    id: string;
    ad_spec_id: string;
    image_id: string;
    template_id: string;
    headline_id: string;
    png_url: string;
    approved: number;
    replaced_by: string | null;
    created_at: string;
  }[];
}

export function setApproval(resultId: string, approved: boolean) {
  const db = getDb();
  db.prepare(`UPDATE render_results SET approved = ? WHERE id = ?`).run(
    approved ? 1 : 0,
    resultId
  );
}

export function markReplaced(oldResultId: string, newResultId: string) {
  const db = getDb();
  db.prepare(`UPDATE render_results SET replaced_by = ? WHERE id = ?`).run(
    newResultId,
    oldResultId
  );
}
