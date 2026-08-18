CREATE TABLE IF NOT EXISTS monitoring_topic_provision_locks (
  telegram_user_id INTEGER NOT NULL,
  staff_chat_id INTEGER NOT NULL,
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telegram_user_id, staff_chat_id)
);
