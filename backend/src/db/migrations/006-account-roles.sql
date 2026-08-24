ALTER TABLE users ADD COLUMN IF NOT EXISTS account_role VARCHAR(20) NOT NULL DEFAULT 'member';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_account_role_check
      CHECK (account_role IN ('overall_admin', 'admin', 'member'));
  END IF;
END $$;

UPDATE users AS app_user
   SET account_role = 'admin'
 WHERE app_user.account_role = 'member'
   AND EXISTS (
     SELECT 1 FROM project_members AS membership
      WHERE membership.user_id = app_user.id AND membership.project_role = 'admin'
   );

DO $$
DECLARE chosen_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE account_role = 'overall_admin') THEN
    SELECT id INTO chosen_id
      FROM users
     WHERE email = 'admin@taskflow.local'
        OR account_role = 'admin'
     ORDER BY CASE WHEN email = 'admin@taskflow.local' THEN 0 ELSE 1 END, id
     LIMIT 1;
    IF chosen_id IS NOT NULL THEN UPDATE users SET account_role = 'overall_admin' WHERE id = chosen_id; END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_overall_admin
  ON users ((account_role)) WHERE account_role = 'overall_admin';
