CREATE TABLE IF NOT EXISTS conversation_control (
  telegram_user_id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai', 'human')),
  claimed_by INTEGER,
  claimed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_control_mode
ON conversation_control(mode, updated_at DESC);

CREATE TABLE IF NOT EXISTS monitoring_topics (
  telegram_user_id INTEGER NOT NULL,
  staff_chat_id INTEGER NOT NULL,
  message_thread_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telegram_user_id, staff_chat_id)
);
