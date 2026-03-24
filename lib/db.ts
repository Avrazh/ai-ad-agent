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
      `CREATE TABLE IF NOT EXISTS saved_ai_styles (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        template_id        TEXT NOT NULL,
        applicability      TEXT,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS developer_feedback (
        id          TEXT PRIMARY KEY,
        message     TEXT NOT NULL,
        image_id    TEXT,
        template_id TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS personas (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        age              TEXT NOT NULL,
        motivation       TEXT NOT NULL,
        pain_point       TEXT NOT NULL,
        objection        TEXT NOT NULL,
        nail_preference  TEXT NOT NULL,
        trigger_message  TEXT NOT NULL,
        creative_angle   TEXT NOT NULL,
        visual_world     TEXT NOT NULL,
        ad_formats       TEXT NOT NULL,
        what_not_to_show TEXT NOT NULL,
        tones            TEXT NOT NULL,
        is_custom        INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL DEFAULT (datetime('now'))
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

  // Additive migration: add tags column to images
  try {
    await client.execute(
      `ALTER TABLE images ADD COLUMN tags TEXT`
    );
  } catch {
    // Column already exists — ignore
  }

  // Additive migration: add surprise_spec column to saved_ai_styles
  try {
    await client.execute(
      `ALTER TABLE saved_ai_styles ADD COLUMN surprise_spec TEXT`
    );
  } catch {
    // Column already exists — ignore
  }

  // Seed default saved AI style if table is empty
  try {
    await client.execute(
      `INSERT OR IGNORE INTO saved_ai_styles (id, name, template_id, estimated_cost_usd)
       VALUES ('sas_default', 'Grid 3×2', 'switch_grid_3x2_no_text', 0)`
    );
  } catch {
    // Ignore — table may not exist yet on very old DBs
  }


  // Migrate personas: add is_custom column if missing
  try {
    await client.execute(`ALTER TABLE personas ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0`);
  } catch { /* already exists */ }

  // Additive migration: store the original clean background URL for ai_background results
  try {
    await client.execute(`ALTER TABLE render_results ADD COLUMN ai_bg_png_url TEXT`);
  } catch { /* already exists */ }

  // Global persona headlines — generated once, no image dependency
  await client.execute(`CREATE TABLE IF NOT EXISTS global_persona_headlines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id TEXT NOT NULL,
  tone       TEXT NOT NULL,
  headline   TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'en',
  slot_type  TEXT NOT NULL DEFAULT 'headline',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

  // Migrate: add slot_type column if missing
  try {
    await client.execute(`ALTER TABLE global_persona_headlines ADD COLUMN slot_type TEXT NOT NULL DEFAULT 'headline'`);
  } catch { /* already exists */ }

  // Cleanup: drop legacy tables no longer used
  for (const t of ["segments", "ai_style_pools", "copy_slots", "persona_image_fit", "persona_headlines"]) {
    try { await client.execute(`DROP TABLE IF EXISTS ${t}`); } catch { /* ignore */ }
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
    tags: row.tags ? JSON.parse(row.tags as string) : null,
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
    tags: row.tags ? JSON.parse(row.tags as string) : null,
  }));
}

// ── Image tags ─────────────────────────────────────────────
export async function upsertImageTags(imageId: string, tags: Record<string, string>) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `UPDATE images SET tags = ? WHERE id = ?`,
    args: [JSON.stringify(tags), imageId],
  });
}

// ── Global Persona Headlines queries ────────────────────────
export async function upsertGlobalPersonaHeadlines(
  rows: { personaId: string; tone: string; headline: string; language: string; slotType?: string }[]
): Promise<void> {
  await ensureMigrated();
  const client = getClient();
  const personaIds = [...new Set(rows.map((r) => r.personaId))];
  for (const pid of personaIds) {
    // Only delete rows of the same slot_type as the incoming batch to avoid clobbering other types
    const slotTypesInBatch = [...new Set(rows.filter((r) => r.personaId === pid).map((r) => r.slotType ?? "headline"))];
    for (const st of slotTypesInBatch) {
      await client.execute({
        sql: `DELETE FROM global_persona_headlines WHERE persona_id = ? AND slot_type = ?`,
        args: [pid, st],
      });
    }
  }
  for (const r of rows) {
    await client.execute({
      sql: `INSERT INTO global_persona_headlines (persona_id, tone, headline, language, slot_type) VALUES (?, ?, ?, ?, ?)`,
      args: [r.personaId, r.tone, r.headline, r.language, r.slotType ?? "headline"],
    });
  }
}

export async function getGlobalPersonaHeadlines(
  personaId: string,
  lang = "en"
): Promise<{ tone: string; headline: string }[]> {
  await ensureMigrated();
  const client = getClient();
  const rows = await client.execute({
    sql: `SELECT tone, headline FROM global_persona_headlines WHERE persona_id = ? AND language = ? AND slot_type = 'headline' ORDER BY tone, id`,
    args: [personaId, lang],
  });
  return rows.rows.map((r) => ({
    tone: r.tone as string,
    headline: r.headline as string,
  }));
}

export async function clearGlobalPersonaHeadlines(): Promise<void> {
  await ensureMigrated();
  const client = getClient();
  await client.execute(`DELETE FROM global_persona_headlines`);
}

export async function getPersonaQuote(
  personaId: string,
  lang = "en"
): Promise<{ text: string; attribution: string } | null> {
  await ensureMigrated();
  const client = getClient();
  const rows = await client.execute({
    sql: `SELECT headline FROM global_persona_headlines WHERE persona_id = ? AND language = ? AND slot_type = 'quote' ORDER BY id LIMIT 1`,
    args: [personaId, lang],
  });
  if (!rows.rows.length) return null;
  const raw = rows.rows[0].headline as string;
  // Format: "Review text. — Sofia M."
  // Split into quote text and attribution
  const dashIdx = raw.lastIndexOf(" — ");
  if (dashIdx !== -1) {
    return { text: raw.slice(0, dashIdx).trim(), attribution: `— ${raw.slice(dashIdx + 3).trim()}` };
  }
  return { text: raw, attribution: "— Verified customer" };
}

export async function hasGlobalPersonaHeadlines(): Promise<boolean> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(
    `SELECT COUNT(*) as n FROM global_persona_headlines WHERE slot_type = 'headline'`
  );
  return ((result.rows[0]?.n as number) ?? 0) > 0;
}

export async function hasGlobalPersonaQuotes(): Promise<boolean> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(
    `SELECT COUNT(*) as n FROM global_persona_headlines WHERE slot_type = 'quote'`
  );
  return ((result.rows[0]?.n as number) ?? 0) > 0;
}

export async function getGlobalPersonaHeadlinesByTone(
  personaId: string,
  tone: string,
  lang = "en"
): Promise<string[]> {
  await ensureMigrated();
  const client = getClient();
  const rows = await client.execute({
    sql: `SELECT headline FROM global_persona_headlines WHERE persona_id = ? AND tone = ? AND language = ? AND slot_type = 'headline' ORDER BY id`,
    args: [personaId, tone, lang],
  });
  return rows.rows.map((r) => r.headline as string);
}

export async function getAllGlobalPersonaHeadlines(
  lang = "en"
): Promise<Record<string, Record<string, string[]>>> {
  await ensureMigrated();
  const client = getClient();
  const rows = await client.execute({
    sql: `SELECT persona_id, tone, headline FROM global_persona_headlines WHERE language = ? ORDER BY persona_id, tone, id`,
    args: [lang],
  });
  const map: Record<string, Record<string, string[]>> = {};
  for (const row of rows.rows) {
    const pid = row.persona_id as string;
    const tone = row.tone as string;
    if (!map[pid]) map[pid] = {};
    if (!map[pid][tone]) map[pid][tone] = [];
    map[pid][tone].push(row.headline as string);
  }
  return map;
}

// ── SafeZones queries ───────────────────────────────────────




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
  aiBgPngUrl?: string;
}) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT INTO render_results (id, ad_spec_id, image_id, family_id, template_id, headline_id, png_url, ai_bg_png_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.id,
      row.adSpecId,
      row.imageId,
      row.familyId,
      row.templateId,
      row.primarySlotId,
      row.pngUrl,
      row.aiBgPngUrl ?? null,
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
    ai_bg_png_url: row.ai_bg_png_url as string | null,
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
    ai_bg_png_url: row.ai_bg_png_url as string | null,
  }));
}

export async function getApprovedResults(): Promise<
  { resultId: string; imageId: string; pngUrl: string; spec: import("@/lib/types").AdSpec }[]
> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(`
    SELECT r.id as result_id, r.image_id, r.png_url, s.data as spec_data
    FROM render_results r
    JOIN ad_specs s ON r.ad_spec_id = s.id
    WHERE r.approved = 1 AND r.replaced_by IS NULL
    ORDER BY r.created_at ASC
  `);
  return result.rows.map((row) => ({
    resultId: row.result_id as string,
    imageId: row.image_id as string,
    pngUrl: row.png_url as string,
    spec: JSON.parse(row.spec_data as string) as import("@/lib/types").AdSpec,
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
      // Delete children before parents to satisfy FK constraints
      `DELETE FROM render_results`,
      `DELETE FROM ad_specs`,
      `DELETE FROM images`,
      // saved_ai_styles intentionally NOT cleared — user preferences persist
    ],
    "write"
  );
}

// ── SavedAIStyle queries ────────────────────────────────────
export async function getSavedAIStyles() {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(
    `SELECT * FROM saved_ai_styles ORDER BY created_at ASC`
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    templateId: row.template_id as string,
    applicability: row.applicability as string | null,
    estimatedCostUsd: row.estimated_cost_usd as number,
    createdAt: row.created_at as string,
    surprise_spec: row.surprise_spec as string | null,
  }));
}

export async function insertSavedAIStyle(row: {
  id: string;
  name: string;
  templateId: string;
  applicability?: string;
  estimatedCostUsd?: number;
  surpriseSpec?: string; // JSON-encoded SurpriseSpec (without en/de copy)
}) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT INTO saved_ai_styles (id, name, template_id, applicability, estimated_cost_usd, surprise_spec)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [row.id, row.name, row.templateId, row.applicability ?? null, row.estimatedCostUsd ?? 0, row.surpriseSpec ?? null],
  });
}

export async function deleteSavedAIStyle(id: string) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `DELETE FROM saved_ai_styles WHERE id = ?`,
    args: [id],
  });
}

// ── DeveloperFeedback queries ───────────────────────────────
export async function insertDeveloperFeedback(row: {
  id: string;
  message: string;
  imageId?: string;
  templateId?: string;
}): Promise<void> {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT INTO developer_feedback (id, message, image_id, template_id) VALUES (?, ?, ?, ?)`,
    args: [row.id, row.message, row.imageId ?? null, row.templateId ?? null],
  });
}

// ── Persona queries ────────────────────────────────────────────
export async function getAllPersonas() {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(`SELECT * FROM personas ORDER BY id`);
  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    age: row.age as string,
    motivation: row.motivation as string,
    painPoint: row.pain_point as string,
    objection: row.objection as string,
    nailPreference: row.nail_preference as string,
    triggerMessage: row.trigger_message as string,
    creativeAngle: row.creative_angle as string,
    visualWorld: row.visual_world as string,
    adFormats: row.ad_formats as string,
    whatNotToShow: row.what_not_to_show as string,
    tones: JSON.parse(row.tones as string) as string[],
    isCustom: !!(row.is_custom as number),
    createdAt: row.created_at as string,
  }));
}

export async function getPersona(id: string) {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM personas WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    name: row.name as string,
    age: row.age as string,
    motivation: row.motivation as string,
    painPoint: row.pain_point as string,
    objection: row.objection as string,
    nailPreference: row.nail_preference as string,
    triggerMessage: row.trigger_message as string,
    creativeAngle: row.creative_angle as string,
    visualWorld: row.visual_world as string,
    adFormats: row.ad_formats as string,
    whatNotToShow: row.what_not_to_show as string,
    tones: JSON.parse(row.tones as string) as string[],
    createdAt: row.created_at as string,
  };
}


export async function insertCustomPersona(name: string, description: string): Promise<string> {
  await ensureMigrated();
  const client = getClient();
  const { newId } = await import('@/lib/ids');
  const id = newId('per');
  await client.execute({
    sql: `INSERT INTO personas (id, name, age, motivation, pain_point, objection, nail_preference, trigger_message, creative_angle, visual_world, ad_formats, what_not_to_show, tones, is_custom) VALUES (?, ?, 'all ages', ?, '', '', '', ?, ?, '', '', '', ?, 1)`,
    args: [id, name, description, description, description, JSON.stringify(['aspirational', 'benefit', 'emotional'])],
  });
  return id;
}

