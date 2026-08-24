BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_deactivated_by_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_deactivated_by_fkey
      FOREIGN KEY (deactivated_by) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_active_directory
  ON users (name, email) WHERE deactivated_at IS NULL;

COMMIT;
