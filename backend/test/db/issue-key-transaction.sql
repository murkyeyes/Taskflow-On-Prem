\set ON_ERROR_STOP on

DELETE FROM projects WHERE key = 'ATX';

SELECT id AS user_id
  FROM users
 WHERE email = 'admin@taskflow.local'
\gset

INSERT INTO projects (key, name, created_by)
VALUES ('ATX', 'Atomic Transaction Test', :user_id)
RETURNING id AS project_id
\gset

INSERT INTO project_members (project_id, user_id, project_role)
VALUES (:project_id, :user_id, 'admin');

INSERT INTO project_issue_sequences (project_id, last_number)
VALUES (:project_id, 0);

INSERT INTO issue_types (project_id, name, color)
VALUES (:project_id, 'Task', '#4C9AFF');

INSERT INTO workflow_statuses (project_id, name, position, is_default, is_final)
VALUES (:project_id, 'To Do', 0, true, false);

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

BEGIN;

SELECT key AS project_key
  FROM projects
 WHERE id = :project_id
 FOR UPDATE
\gset

UPDATE project_issue_sequences
   SET last_number = last_number + 1
 WHERE project_id = :project_id
RETURNING last_number
\gset

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
    :'project_key' || '-' || :last_number,
    'Atomic issue creation proof',
    :issue_type_id,
    :status_id,
    :user_id
)
RETURNING id AS issue_id, issue_key
\gset

INSERT INTO issue_status_history (
    issue_id,
    from_status_id,
    to_status_id,
    changed_by
)
VALUES (
    :issue_id,
    NULL,
    :status_id,
    :user_id
);

COMMIT;

DO $$
DECLARE
    target_project_id INTEGER;
    target_issue_id INTEGER;
BEGIN
    SELECT id INTO target_project_id FROM projects WHERE key = 'ATX';
    SELECT id INTO target_issue_id FROM issues WHERE issue_key = 'ATX-1';

    IF (SELECT last_number FROM project_issue_sequences WHERE project_id = target_project_id) <> 1 THEN
        RAISE EXCEPTION 'Sequence did not commit as 1';
    END IF;

    IF target_issue_id IS NULL THEN
        RAISE EXCEPTION 'Issue ATX-1 was not committed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM issue_status_history
         WHERE issue_id = target_issue_id
           AND from_status_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Initial issue status history was not committed';
    END IF;
END
$$;

SELECT 'atomic issue transaction passed' AS result;
