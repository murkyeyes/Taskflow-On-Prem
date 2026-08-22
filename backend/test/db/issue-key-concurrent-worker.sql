\set ON_ERROR_STOP on

BEGIN;

WITH locked_project AS MATERIALIZED (
    SELECT id, key, created_by
      FROM projects
     WHERE key = 'ATX'
     FOR UPDATE
),
next_number AS (
    UPDATE project_issue_sequences AS sequence
       SET last_number = sequence.last_number + 1
      FROM locked_project AS project
     WHERE sequence.project_id = project.id
    RETURNING sequence.project_id, sequence.last_number
),
default_status AS (
    SELECT status.id
      FROM workflow_statuses AS status
      JOIN locked_project AS project ON project.id = status.project_id
     WHERE status.is_default = true
),
default_type AS (
    SELECT type.id
      FROM issue_types AS type
      JOIN locked_project AS project ON project.id = type.project_id
     WHERE type.name = 'Task'
),
new_issue AS (
    INSERT INTO issues (
        project_id,
        issue_key,
        title,
        issue_type_id,
        status_id,
        reporter_id
    )
    SELECT project.id,
           project.key || '-' || next_number.last_number,
           'Concurrent issue ' || next_number.last_number,
           default_type.id,
           default_status.id,
           project.created_by
      FROM locked_project AS project
      JOIN next_number ON next_number.project_id = project.id
      CROSS JOIN default_status
      CROSS JOIN default_type
    RETURNING id, status_id, reporter_id
)
INSERT INTO issue_status_history (
    issue_id,
    from_status_id,
    to_status_id,
    changed_by
)
SELECT id, NULL, status_id, reporter_id
  FROM new_issue;

COMMIT;
