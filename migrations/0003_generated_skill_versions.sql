ALTER TABLE generated_skills RENAME TO generated_skills_legacy;

CREATE TABLE IF NOT EXISTS generated_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  body_json TEXT NOT NULL,
  allowed_tools TEXT,
  version INTEGER NOT NULL,
  is_old INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL,
  auto_approval_reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(name, version)
);

INSERT INTO generated_skills (
  id,
  name,
  description,
  body,
  body_json,
  allowed_tools,
  version,
  is_old,
  disabled,
  confidence,
  auto_approval_reason,
  created_at,
  updated_at
)
SELECT
  id,
  name,
  description,
  body,
  json_object(
    'goal', description,
    'triggers', json_array(description),
    'instructions', json_array(body),
    'safetyNotes', json_array('Legacy generated skill migrated from raw body text.'),
    'toolUsage',
      CASE
        WHEN allowed_tools IS NULL THEN json_array()
        ELSE json_array(json_object('tool', allowed_tools, 'when', 'Use according to the migrated skill body.'))
      END
  ),
  allowed_tools,
  version,
  0,
  disabled,
  confidence,
  auto_approval_reason,
  created_at,
  updated_at
FROM generated_skills_legacy;

CREATE INDEX IF NOT EXISTS idx_generated_skills_current_enabled
  ON generated_skills (disabled, is_old, name);

CREATE INDEX IF NOT EXISTS idx_generated_skills_name_current
  ON generated_skills (name, is_old);

CREATE INDEX IF NOT EXISTS idx_generated_skills_updated_at
  ON generated_skills (updated_at);
