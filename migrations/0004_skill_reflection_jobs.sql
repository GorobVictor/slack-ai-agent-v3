CREATE TABLE IF NOT EXISTS skill_reflection_jobs (
  idempotency_key TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'skipped', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  result_status TEXT,
  result_name TEXT,
  skip_reason TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skill_reflection_jobs_status_updated
  ON skill_reflection_jobs (status, updated_at);
