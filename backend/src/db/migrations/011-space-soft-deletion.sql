BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_projects_active_name
  ON projects (name, id)
  WHERE deleted_at IS NULL;

COMMIT;
