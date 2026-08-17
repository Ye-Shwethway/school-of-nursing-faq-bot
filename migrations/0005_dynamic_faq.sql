CREATE TABLE IF NOT EXISTS faq_entries (
  faq_key TEXT PRIMARY KEY,
  question_my TEXT NOT NULL,
  answer_my TEXT NOT NULL,
  question_en TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  question_zh TEXT NOT NULL,
  answer_zh TEXT NOT NULL,
  keywords_my TEXT NOT NULL DEFAULT '[]',
  keywords_en TEXT NOT NULL DEFAULT '[]',
  keywords_zh TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_faq_entries_active_updated
ON faq_entries(active, updated_at DESC);

CREATE TABLE IF NOT EXISTS faq_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faq_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'disable', 'restore')),
  before_json TEXT,
  after_json TEXT,
  actor_telegram_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_faq_revisions_key_created
ON faq_revisions(faq_key, created_at DESC);
