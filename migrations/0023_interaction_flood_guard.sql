CREATE TABLE IF NOT EXISTS user_interaction_limits (
  telegram_user_id INTEGER PRIMARY KEY,
  window_started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  last_notice_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interaction_limits_blocked
ON user_interaction_limits(blocked_until);
