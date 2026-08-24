BEGIN;

-- Phase 24 changes the default Space grant from read-only Viewer to editable
-- Member. Upgrade existing grants for application Member accounts so the UI
-- and API agree immediately after deployment.
UPDATE project_members AS membership
   SET project_role = 'member'
  FROM users AS app_user
 WHERE app_user.id = membership.user_id
   AND app_user.account_role = 'member'
   AND membership.project_role = 'viewer';

COMMIT;
