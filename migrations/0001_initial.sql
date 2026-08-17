CREATE TABLE IF NOT EXISTS users (
  telegram_user_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language TEXT CHECK (language IN ('my','en','zh')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  message_id INTEGER,
  question TEXT NOT NULL,
  language TEXT,
  resolution TEXT NOT NULL DEFAULT 'pending',
  matched_faq_key TEXT,
  answer_source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_questions_user_created ON questions(telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_resolution_created ON questions(resolution, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_roles (
  telegram_user_id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('sudo_admin')),
  granted_by INTEGER NOT NULL,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_telegram_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_telegram_user_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
