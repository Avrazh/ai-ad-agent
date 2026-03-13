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
      `CREATE TABLE IF NOT EXISTS ai_style_pools (
        image_id TEXT PRIMARY KEY,
        data     TEXT NOT NULL,
        FOREIGN KEY (image_id) REFERENCES images(id)
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
      `CREATE TABLE IF NOT EXISTS segments (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        age_focus   TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS personas (
        id               TEXT PRIMARY KEY,
        segment_id       TEXT NOT NULL,
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
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (segment_id) REFERENCES segments(id)
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
      `DELETE FROM ai_style_pools`,
      `DELETE FROM images`,
      // saved_ai_styles intentionally NOT cleared — user preferences persist
    ],
    "write"
  );
}

// ── AIStylePool queries ─────────────────────────────────────
export async function upsertAIStylePool(imageId: string, data: string) {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: `INSERT OR REPLACE INTO ai_style_pools (image_id, data) VALUES (?, ?)`,
    args: [imageId, data],
  });
}

export async function getAIStylePool(imageId: string): Promise<string | undefined> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT data FROM ai_style_pools WHERE image_id = ?`,
    args: [imageId],
  });
  const row = result.rows[0];
  return row ? (row.data as string) : undefined;
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

// ── Segment queries ───────────────────────────────────────────
export async function getAllSegments() {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(`SELECT * FROM segments ORDER BY id`);
  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    ageFocus: row.age_focus as string,
    createdAt: row.created_at as string,
  }));
}

// ── Persona queries ────────────────────────────────────────────
export async function getAllPersonas() {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(`SELECT * FROM personas ORDER BY segment_id, id`);
  return result.rows.map((row) => ({
    id: row.id as string,
    segmentId: row.segment_id as string,
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
  }));
}

export async function getPersonasBySegment(segmentId: string) {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM personas WHERE segment_id = ? ORDER BY id`,
    args: [segmentId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    segmentId: row.segment_id as string,
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
    segmentId: row.segment_id as string,
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

// -- Seed segments & personas (idempotent) ---------------------
export async function seedSegmentsAndPersonas() {
  await ensureMigrated();
  const client = getClient();

  const segments = [
    { id: "seg_trend", name: "Trend-Driven Expressionists", description: "Fashion-forward individuals who follow nail trends closely and use nails as a form of self-expression and identity", age_focus: "18-28" },
    { id: "seg_busy", name: "Busy Professionals & Moms", description: "Time-poor women who want to look put-together without spending hours on nail maintenance", age_focus: "28-45" },
    { id: "seg_occasion", name: "Occasion & Event Seekers", description: "Women who want special nails for specific events like weddings, parties, or holidays", age_focus: "20-40" },
    { id: "seg_budget", name: "Budget-Conscious Beauty Lovers", description: "Value-seekers who love beauty but are price-sensitive and compare options carefully", age_focus: "18-35" },
    { id: "seg_natural", name: "Natural Nail Protectors", description: "Women who avoid traditional nail polish due to damage concerns and want healthy nail alternatives", age_focus: "25-45" },
    { id: "seg_new", name: "Press-On Newcomers", description: "Women who are new to press-on nails and need reassurance about quality, ease, and results", age_focus: "22-40" },
  ];

  for (const seg of segments) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO segments (id, name, description, age_focus) VALUES (?, ?, ?, ?)',
      args: [seg.id, seg.name, seg.description, seg.age_focus],
    });
  }

  type PersonaRow = {
    id: string; segment_id: string; name: string; age: string;
    motivation: string; pain_point: string; objection: string;
    nail_preference: string; trigger_message: string; creative_angle: string;
    visual_world: string; ad_formats: string; what_not_to_show: string;
    tones: string[];
  };

  const personas: PersonaRow[] = [
    { id: "per_trend_1", segment_id: "seg_trend", name: "The Aesthetic Curator", age: "19-24",
      motivation: "Wants nails that match her carefully crafted aesthetic and can be changed frequently to stay current",
      pain_point: "Salon visits are too slow and expensive to keep up with fast-changing trends",
      objection: "Press-ons look fake and basic compared to salon work",
      nail_preference: "Trendy sets: chrome, abstract art, 3D details, seasonal colors",
      trigger_message: "New drop: the exact nail set you saw on your FYP",
      creative_angle: "Aspirational visuals showing the nail set as part of a full aesthetic lifestyle",
      visual_world: "Flat lays, mood boards, aesthetic room setups, color-coordinated outfits",
      ad_formats: "Reels, TikTok videos, carousel posts, stories",
      what_not_to_show: "Plain or conservative nail styles; clinical before/after shots",
      tones: ["aspirational", "emotional"] },
    { id: "per_trend_2", segment_id: "seg_trend", name: "The Social Media Native", age: "18-22",
      motivation: "Uses nails as content - wants sets that photograph well and get engagement",
      pain_point: "Hard to find nails that look as good in photos as they do on screen",
      objection: "Not sure if press-ons will stay on long enough for a shoot or event",
      nail_preference: "Bold statement sets, unique textures, photo-ready designs",
      trigger_message: "The nails your followers will ask about",
      creative_angle: "Show the content creation process - nails in flat lay, holding phone, in mirror selfie",
      visual_world: "Ring lights, content creator setups, phone screens showing likes, aesthetic backdrops",
      ad_formats: "TikTok native content, Instagram reels, UGC-style videos",
      what_not_to_show: "Overly polished corporate-looking ads; nails that look too catalog",
      tones: ["aspirational", "curiosity"] },
    { id: "per_trend_3", segment_id: "seg_trend", name: "The Bold Experimenter", age: "20-27",
      motivation: "Wants to try daring styles without committing to permanent nail damage",
      pain_point: "Traditional nail polish chips quickly; gel is hard to remove and damages nails",
      objection: "Worried about the application process being too complicated",
      nail_preference: "Maximalist, avant-garde, experimental sets",
      trigger_message: "Try the trend. No commitment needed.",
      creative_angle: "Freedom and experimentation - before/after showing transformation without damage",
      visual_world: "Artistic photography, bold colors, creative lifestyle shots",
      ad_formats: "Transformation videos, before/after reels, tutorial content",
      what_not_to_show: "Boring or understated designs; anything that implies limitation",
      tones: ["curiosity", "contrast"] },
    { id: "per_busy_1", segment_id: "seg_busy", name: "The Corporate Professional", age: "28-38",
      motivation: "Wants polished, professional nails that last through a busy work week without maintenance",
      pain_point: "No time for salon appointments during the week; weekend appointments fill her schedule",
      objection: "Press-ons might look unprofessional or fall off at an important meeting",
      nail_preference: "Classic, clean designs: nude, French, subtle shimmer",
      trigger_message: "Professional nails in 10 minutes. No appointment needed.",
      creative_angle: "Time-saving focus - show application speed and professional result",
      visual_world: "Office settings, laptops, coffee cups, clean workspaces",
      ad_formats: "Quick tutorial videos, before/after stories, testimonials",
      what_not_to_show: "Overly decorative or casual nail styles; messy application processes",
      tones: ["benefit", "urgency"] },
    { id: "per_busy_2", segment_id: "seg_busy", name: "The Multitasking Mom", age: "30-42",
      motivation: "Wants to feel put-together and like herself again amid the chaos of motherhood",
      pain_point: "Self-care falls to the bottom of the priority list; salon time feels selfish",
      objection: "Press-ons will pop off during childcare tasks or while washing dishes",
      nail_preference: "Practical yet pretty: short to medium length, neutral to soft colors",
      trigger_message: "5 minutes. Beautiful nails. One less thing to worry about.",
      creative_angle: "Emotional - the small self-care moment that makes a big difference",
      visual_world: "Home environments, morning routines, relatable everyday moments",
      ad_formats: "Relatable video content, testimonials from moms, quick tutorial stories",
      what_not_to_show: "Overly glamorous lifestyles; long nails that imply fragility",
      tones: ["emotional", "benefit"] },
    { id: "per_busy_3", segment_id: "seg_busy", name: "The Always-On Entrepreneur", age: "27-40",
      motivation: "Values efficiency and quality - wants nails that represent her brand without wasting time",
      pain_point: "Every hour counts; traditional beauty routines feel like a poor investment of time",
      objection: "Skeptical about quality - has tried cheap press-ons before that looked and felt bad",
      nail_preference: "Sophisticated, intentional sets that signal success and taste",
      trigger_message: "High-quality nails on your schedule, not the salon's.",
      creative_angle: "Premium efficiency - position Switch Nails as the smart choice for successful women",
      visual_world: "Minimal, high-end aesthetics; planning tools, brand environments, quality details",
      ad_formats: "Premium-looking video ads, LinkedIn-style content, quality-focused testimonials",
      what_not_to_show: "Budget-focused messaging; anything that implies compromise on quality",
      tones: ["benefit", "aspirational"] },
    { id: "per_occ_1", segment_id: "seg_occasion", name: "The Bride-to-Be", age: "24-35",
      motivation: "Wants perfect nails for her wedding day that photograph beautifully and last all day",
      pain_point: "Wedding nail appointments are expensive and hard to schedule; bridal nail fails are a real fear",
      objection: "Worried press-ons will not look natural enough for wedding photos",
      nail_preference: "Bridal sets: soft pink, French, pearl, elegant details",
      trigger_message: "Wedding-perfect nails you can rely on. No last-minute salon panic.",
      creative_angle: "Dream wedding aesthetic - nails as part of the perfect day",
      visual_world: "Wedding settings, bouquets, veils, soft natural lighting, detail shots",
      ad_formats: "Pinterest-style imagery, Instagram carousels, wedding content partnerships",
      what_not_to_show: "Bold or trendy styles; anything that looks temporary or casual",
      tones: ["aspirational", "emotional"] },
    { id: "per_occ_2", segment_id: "seg_occasion", name: "The Party Girl", age: "20-30",
      motivation: "Wants show-stopping nails for nights out, birthdays, and special events",
      pain_point: "Salon availability before events is unpredictable; last-minute nail emergencies are common",
      objection: "Worried nails will come off while dancing or during a long night out",
      nail_preference: "Glam, bold sets: rhinestones, holographic, party-ready designs",
      trigger_message: "Ready for the party in minutes. Nails that last all night.",
      creative_angle: "High-energy, fun, FOMO-inducing - the nails that complete the look",
      visual_world: "Party settings, night out photography, friends, celebration moments",
      ad_formats: "High-energy reels, before/after getting-ready content, event photography",
      what_not_to_show: "Subdued or professional settings; anything that feels low-energy",
      tones: ["urgency", "emotional"] },
    { id: "per_occ_3", segment_id: "seg_occasion", name: "The Holiday Dresser", age: "22-40",
      motivation: "Wants themed, seasonal nails that match holiday outfits and festive moments",
      pain_point: "Holiday-specific nail designs are only available for a short window and sell out fast",
      objection: "Not sure if seasonal designs are worth the investment for a short period",
      nail_preference: "Seasonal collections: holiday themes, festive colors, limited edition designs",
      trigger_message: "Limited edition holiday sets. Get them before they are gone.",
      creative_angle: "Scarcity and seasonal excitement - limited time, limited stock",
      visual_world: "Holiday settings, festive decorations, seasonal colors, gift-wrapped aesthetics",
      ad_formats: "Stories with countdown timers, seasonal email campaigns, limited drop announcements",
      what_not_to_show: "Everyday or generic designs; anything that undermines the special occasion feel",
      tones: ["urgency", "aspirational"] },
    { id: "per_bud_1", segment_id: "seg_budget", name: "The Value Seeker", age: "18-28",
      motivation: "Loves beauty but has a tight budget - needs to justify every purchase",
      pain_point: "Salon nails cost too much and chip within a week anyway",
      objection: "Press-ons seem like a waste of money if they fall off after a day",
      nail_preference: "Good-looking sets at a fair price; quality that matches the cost",
      trigger_message: "Salon-quality nails at a fraction of the price.",
      creative_angle: "Value comparison - cost per wear vs. salon price breakdown",
      visual_world: "Relatable everyday settings; shopping moments; practical lifestyle",
      ad_formats: "Comparison content, price-focused stories, testimonials emphasizing durability",
      what_not_to_show: "Luxury or aspirational imagery that feels out of reach",
      tones: ["benefit", "contrast"] },
    { id: "per_bud_2", segment_id: "seg_budget", name: "The Smart Shopper", age: "22-35",
      motivation: "Researches purchases carefully and wants the best quality for her money",
      pain_point: "Overwhelmed by options; has been burned by cheap products before",
      objection: "How do I know Switch Nails is better than the cheap ones on Amazon?",
      nail_preference: "Reliable, well-reviewed sets with proven staying power",
      trigger_message: "The press-on nails that actually last. Here is the proof.",
      creative_angle: "Social proof and evidence - reviews, wear tests, before/after day 7",
      visual_world: "Product detail shots, review screenshots, real wear documentation",
      ad_formats: "Review-focused content, testimonial compilations, wear test videos",
      what_not_to_show: "Vague quality claims without evidence; overly promotional tone",
      tones: ["benefit", "story"] },
    { id: "per_bud_3", segment_id: "seg_budget", name: "The Occasional Treater", age: "25-40",
      motivation: "Treats herself to beauty purchases a few times a year - wants them to feel special",
      pain_point: "Feels guilty spending on herself; needs to feel the purchase is worthwhile",
      objection: "Is this really worth treating myself to, or will I regret it?",
      nail_preference: "A set that feels luxurious but is priced fairly",
      trigger_message: "You deserve this. And it costs less than you think.",
      creative_angle: "Permission to treat yourself - emotional validation of self-investment",
      visual_world: "Self-care moments, cozy home settings, personal pampering rituals",
      ad_formats: "Emotional video content, self-care focused stories, gifting-angle campaigns",
      what_not_to_show: "Overly frugal messaging; anything that diminishes the treat feeling",
      tones: ["emotional", "benefit"] },
    { id: "per_nat_1", segment_id: "seg_natural", name: "The Nail Health Advocate", age: "25-40",
      motivation: "Prioritizes nail health and wants beauty without damage",
      pain_point: "Gel and acrylic have ruined her natural nails in the past",
      objection: "Will press-ons damage my natural nails when I remove them?",
      nail_preference: "Clean, natural-looking sets that let nails breathe",
      trigger_message: "Beautiful nails without the damage. Your natural nails will thank you.",
      creative_angle: "Education-first - explain the safe removal process and nail-friendly formula",
      visual_world: "Clean beauty aesthetics, healthy nail close-ups, natural product photography",
      ad_formats: "Educational content, how-to removal videos, nail health testimonials",
      what_not_to_show: "Damaged nails, harsh chemicals, long extension imagery",
      tones: ["benefit", "story"] },
    { id: "per_nat_2", segment_id: "seg_natural", name: "The Allergy-Aware Beauty", age: "28-45",
      motivation: "Has sensitivities to traditional nail products and needs safe alternatives",
      pain_point: "Allergic reactions to gel and polish have made her give up on nail beauty",
      objection: "What if I react to the adhesive on press-ons too?",
      nail_preference: "Gentle, hypoallergenic options with safe adhesive",
      trigger_message: "Nail beauty designed for sensitive skin. Finally.",
      creative_angle: "Safety and inclusivity - Switch Nails as the solution for those excluded by traditional products",
      visual_world: "Clean, clinical beauty aesthetics; ingredient focus; gentle imagery",
      ad_formats: "Educational content, ingredient-focused stories, testimonials from sensitive users",
      what_not_to_show: "Any imagery that suggests chemical exposure or harsh treatments",
      tones: ["benefit", "emotional"] },
    { id: "per_nat_3", segment_id: "seg_natural", name: "The Minimalist Natural", age: "28-42",
      motivation: "Prefers a natural, understated look and is skeptical of artificial nail solutions",
      pain_point: "Most press-ons look obviously fake and do not match her aesthetic",
      objection: "Press-ons never look natural enough for my taste",
      nail_preference: "Short, natural-finish, barely-there designs",
      trigger_message: "Press-ons that look like they grew that way.",
      creative_angle: "Natural finish focus - close-up photography emphasizing realism",
      visual_world: "Minimalist aesthetics, natural light photography, clean and simple compositions",
      ad_formats: "Close-up product photography, side-by-side natural comparison, editorial content",
      what_not_to_show: "Long, dramatic, or obviously artificial nail styles",
      tones: ["contrast", "benefit"] },
    { id: "per_new_1", segment_id: "seg_new", name: "The Curious First-Timer", age: "22-35",
      motivation: "Interested in press-ons but has never tried them and does not know where to start",
      pain_point: "Intimidated by the application process; afraid of wasting money on something she cannot use",
      objection: "What if I put them on wrong and they look bad?",
      nail_preference: "Starter-friendly kits with clear instructions",
      trigger_message: "First time? We make it impossible to mess up.",
      creative_angle: "Step-by-step reassurance - show exactly how easy the application is",
      visual_world: "Tutorial-style content, friendly instructional imagery, relatable beginner settings",
      ad_formats: "Tutorial videos, step-by-step stories, FAQ content, beginner guides",
      what_not_to_show: "Complex application processes; anything that implies prior experience needed",
      tones: ["benefit", "story"] },
    { id: "per_new_2", segment_id: "seg_new", name: "The Skeptical Converter", age: "25-40",
      motivation: "Has heard about press-ons but dismissed them as low quality - needs to be convinced",
      pain_point: "Previous experience with cheap press-ons was negative; expects the same",
      objection: "I have tried press-ons before and they looked terrible and fell off",
      nail_preference: "High-quality, long-lasting sets that prove her wrong",
      trigger_message: "These are not the press-ons you remember.",
      creative_angle: "Direct comparison and transformation - skeptical before, converted after",
      visual_world: "High-quality product photography, durability demonstrations, real results",
      ad_formats: "Testimonial content, comparison videos, wear test documentation",
      what_not_to_show: "Anything that looks cheap or low-quality; vague quality claims",
      tones: ["contrast", "story"] },
    { id: "per_new_3", segment_id: "seg_new", name: "The Gifted Introducer", age: "22-38",
      motivation: "Received press-ons as a gift or saw a friend wearing them - exploring for herself",
      pain_point: "Not sure which set to choose first from a wide range",
      objection: "I do not know enough about sizes, styles, or how to pick the right set",
      nail_preference: "Beginner-friendly selection with guidance on choosing",
      trigger_message: "Not sure where to start? We will help you find your perfect set.",
      creative_angle: "Guided discovery - help her find her style through quiz or recommendation",
      visual_world: "Gift unboxing, friendly discovery moments, styling guidance content",
      ad_formats: "Quiz-style content, gift guide campaigns, onboarding email sequences",
      what_not_to_show: "Overwhelming choice without guidance; expert-only language",
      tones: ["curiosity", "benefit"] },
  ];

  for (const p of personas) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO personas (id, segment_id, name, age, motivation, pain_point, objection, nail_preference, trigger_message, creative_angle, visual_world, ad_formats, what_not_to_show, tones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [p.id, p.segment_id, p.name, p.age, p.motivation, p.pain_point, p.objection, p.nail_preference, p.trigger_message, p.creative_angle, p.visual_world, p.ad_formats, p.what_not_to_show, JSON.stringify(p.tones)],
    });
  }

  return { segments: segments.length, personas: personas.length };
}
