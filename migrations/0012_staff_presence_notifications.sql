CREATE TABLE IF NOT EXISTS staff_presence (
  telegram_user_id INTEGER PRIMARY KEY,
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
VALUES ('staff_notifications_enabled', '1', 0, CURRENT_TIMESTAMP);
