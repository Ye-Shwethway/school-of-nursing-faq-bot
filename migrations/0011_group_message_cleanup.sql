CREATE TABLE IF NOT EXISTS group_message_ledger (
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_ledger_chat_time
  ON group_message_ledger (chat_id, observed_at);
