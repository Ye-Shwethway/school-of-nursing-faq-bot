DROP INDEX IF EXISTS idx_user_interaction_limits_blocked;

CREATE TABLE IF NOT EXISTS user_interaction_limits_v2 (
  telegram_user_id INTEGER PRIMARY KEY,
  window_started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  last_notice_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO user_interaction_limits_v2
  (telegram_user_id, window_started_at, window_count, blocked_until, last_notice_at, updated_at)
SELECT telegram_user_id, window_started_at, window_count, blocked_until, last_notice_at, updated_at
FROM user_interaction_limits;

DROP TABLE user_interaction_limits;
ALTER TABLE user_interaction_limits_v2 RENAME TO user_interaction_limits;

CREATE INDEX IF NOT EXISTS idx_user_interaction_limits_blocked
ON user_interaction_limits(blocked_until);
