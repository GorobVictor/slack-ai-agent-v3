CREATE TABLE IF NOT EXISTS generated_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  allowed_tools TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  disabled INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL,
  auto_approval_reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generated_skills_disabled
  ON generated_skills (disabled);

CREATE INDEX IF NOT EXISTS idx_generated_skills_name
  ON generated_skills (name);

CREATE INDEX IF NOT EXISTS idx_generated_skills_updated_at
  ON generated_skills (updated_at);
