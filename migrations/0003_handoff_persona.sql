CREATE TABLE IF NOT EXISTS bot_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_members (
  telegram_user_id INTEGER PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1,
  added_by INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS escalation_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id INTEGER NOT NULL,
  source_question_id INTEGER,
  language TEXT,
  user_question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','resolved','closed')),
  staff_chat_id INTEGER,
  staff_message_id INTEGER,
  claimed_by INTEGER,
  claimed_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_user_id),
  FOREIGN KEY (source_question_id) REFERENCES questions(id)
);

CREATE INDEX IF NOT EXISTS idx_escalation_cases_status_created
ON escalation_cases(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escalation_cases_user_created
ON escalation_cases(telegram_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS escalation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('user_to_staff','staff_to_user')),
  telegram_user_id INTEGER,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES escalation_cases(id)
);
