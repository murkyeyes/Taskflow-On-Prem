\set ON_ERROR_STOP on

BEGIN;

SELECT id AS project_id, created_by AS user_id
  FROM projects
 WHERE key = 'ATX'
 FOR UPDATE
\gset

UPDATE project_issue_sequences
   SET last_number = last_number + 1
 WHERE project_id = :project_id
RETURNING last_number
\gset

SELECT id AS issue_type_id
  FROM issue_types
 WHERE project_id = :project_id
   AND name = 'Task'
\gset

SELECT id AS status_id
  FROM workflow_statuses
 WHERE project_id = :project_id
   AND is_default = true
\gset

-- This deliberately violates issues.issue_key uniqueness after the sequence update.
INSERT INTO issues (
    project_id,
    issue_key,
    title,
    issue_type_id,
    status_id,
    reporter_id
)
VALUES (
    :project_id,
    'ATX-1',
    'This insert must fail and roll back',
    :issue_type_id,
    :status_id,
    :user_id
);

COMMIT;
