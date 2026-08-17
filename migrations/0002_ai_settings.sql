CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  provider TEXT PRIMARY KEY,
  encrypted_key TEXT NOT NULL,
  key_iv TEXT NOT NULL,
  base_url TEXT,
  updated_by INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_tested_at TEXT,
  last_test_ok INTEGER
);

CREATE TABLE IF NOT EXISTS ai_model_cache (
  provider TEXT NOT NULL,
  token TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, token),
  UNIQUE (provider, model_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_model_cache_provider
ON ai_model_cache(provider, fetched_at DESC);

CREATE TABLE IF NOT EXISTS ai_model_tests (
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  tested_by INTEGER NOT NULL,
  tested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ok INTEGER NOT NULL,
  PRIMARY KEY (provider, model_id)
);

CREATE TABLE IF NOT EXISTS ai_model_bindings (
  binding_key TEXT PRIMARY KEY,
  primary_provider TEXT,
  primary_model TEXT,
  fallback_provider TEXT,
  fallback_model TEXT,
  updated_by INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  telegram_user_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  provider TEXT,
  payload TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
