CREATE TABLE IF NOT EXISTS user_rate_limits (
  telegram_user_id INTEGER PRIMARY KEY,
  window_started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_count INTEGER NOT NULL DEFAULT 0,
  cooldown_until TEXT,
  strike_count INTEGER NOT NULL DEFAULT 0,
  last_limit_hit_at TEXT,
  exempt_until TEXT,
  temporary_restricted_until TEXT,
  permanently_banned INTEGER NOT NULL DEFAULT 0 CHECK (permanently_banned IN (0,1)),
  banned_at TEXT,
  banned_by INTEGER,
  ban_reason TEXT,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_rate_limits_cooldown
ON user_rate_limits(cooldown_until);

CREATE INDEX IF NOT EXISTS idx_user_rate_limits_banned
ON user_rate_limits(permanently_banned, updated_at DESC);
