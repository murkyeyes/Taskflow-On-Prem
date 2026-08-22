BEGIN;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE issues AS issue
   SET completed_at = COALESCE(
       (
         SELECT max(history.changed_at)
           FROM issue_status_history AS history
          WHERE history.issue_id = issue.id
            AND history.to_status_id = issue.status_id
       ),
       issue.updated_at,
       issue.created_at
   )
  FROM workflow_statuses AS status
 WHERE status.id = issue.status_id
   AND status.is_final
   AND issue.completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_issues_project_created_at
    ON issues(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_issues_project_completed_at
    ON issues(project_id, completed_at);

COMMIT;
