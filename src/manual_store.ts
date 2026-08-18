export type ManualKey = "owner" | "admin";

export type ManualSection = {
  manualKey: ManualKey;
  sectionKey: string;
  title: string;
  body: string;
  sortOrder: number;
  version: number;
};

function normalizeManualText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function mapSection(row: {
  manual_key: ManualKey;
  section_key: string;
  title: string;
  body: string;
  sort_order: number;
  version: number;
}): ManualSection {
  return {
    manualKey: row.manual_key,
    sectionKey: row.section_key,
    title: row.title,
    body: normalizeManualText(row.body),
    sortOrder: row.sort_order,
    version: row.version,
  };
}

export async function listManualSections(
  db: D1Database | undefined,
  manualKey: ManualKey,
): Promise<ManualSection[]> {
  if (!db) return [];
  const rows = await db.prepare(
    `SELECT manual_key, section_key, title, body, sort_order, version
     FROM manual_sections
     WHERE manual_key=?1
     ORDER BY sort_order ASC, section_key ASC`,
  ).bind(manualKey).all<{
    manual_key: ManualKey;
    section_key: string;
    title: string;
    body: string;
    sort_order: number;
    version: number;
  }>();
  return (rows.results ?? []).map(mapSection);
}

export async function getManualSection(
  db: D1Database | undefined,
  manualKey: ManualKey,
  sectionKey: string,
): Promise<ManualSection | null> {
  if (!db) return null;
  const row = await db.prepare(
    `SELECT manual_key, section_key, title, body, sort_order, version
     FROM manual_sections
     WHERE manual_key=?1 AND section_key=?2`,
  ).bind(manualKey, sectionKey).first<{
    manual_key: ManualKey;
    section_key: string;
    title: string;
    body: string;
    sort_order: number;
    version: number;
  }>();
  return row ? mapSection(row) : null;
}

export async function createManualSection(
  db: D1Database,
  manualKey: ManualKey,
  title: string,
  body: string,
  actorId: number,
): Promise<ManualSection> {
  const maxRow = await db.prepare(
    `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
     FROM manual_sections WHERE manual_key=?1`,
  ).bind(manualKey).first<{ max_sort: number }>();

  const sortOrder = Number(maxRow?.max_sort ?? 0) + 10;
  const sectionKey = `custom-${crypto.randomUUID()}`;
  const normalizedTitle = normalizeManualText(title).trim();
  const normalizedBody = normalizeManualText(body).trim();

  await db.prepare(
    `INSERT INTO manual_sections
      (manual_key, section_key, title, body, sort_order, version, updated_by, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, CURRENT_TIMESTAMP)`,
  ).bind(manualKey, sectionKey, normalizedTitle, normalizedBody, sortOrder, actorId).run();

  return {
    manualKey,
    sectionKey,
    title: normalizedTitle,
    body: normalizedBody,
    sortOrder,
    version: 1,
  };
}

export async function updateManualSection(
  db: D1Database,
  manualKey: ManualKey,
  sectionKey: string,
  body: string,
  actorId: number,
): Promise<ManualSection | null> {
  const current = await getManualSection(db, manualKey, sectionKey);
  if (!current) return null;

  const normalizedBody = normalizeManualText(body);

  await db.prepare(
    `INSERT INTO manual_revisions
      (manual_key, section_key, version, title, body, changed_by, changed_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)`,
  ).bind(manualKey, sectionKey, current.version, current.title, current.body, actorId).run();

  await db.prepare(
    `UPDATE manual_sections
     SET body=?3, version=version+1, updated_by=?4, updated_at=CURRENT_TIMESTAMP
     WHERE manual_key=?1 AND section_key=?2`,
  ).bind(manualKey, sectionKey, normalizedBody, actorId).run();

  return getManualSection(db, manualKey, sectionKey);
}
