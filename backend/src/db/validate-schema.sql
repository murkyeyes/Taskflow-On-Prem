DO $$
DECLARE
    actual_count INTEGER;
BEGIN
    SELECT count(*)
      INTO actual_count
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name = ANY (ARRAY[
           'users',
           'projects',
           'project_members',
           'project_issue_sequences',
           'issue_types',
           'workflow_statuses',
           'issues',
           'issue_status_history',
           'comments'
       ]);

    IF actual_count <> 9 THEN
        RAISE EXCEPTION 'Expected 9 application tables, found %', actual_count;
    END IF;

    SELECT count(*)
      INTO actual_count
      FROM information_schema.table_constraints
     WHERE constraint_schema = 'public'
       AND constraint_type = 'FOREIGN KEY';

    IF actual_count <> 17 THEN
        RAISE EXCEPTION 'Expected 17 foreign keys, found %', actual_count;
    END IF;

    SELECT count(*)
      INTO actual_count
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND is_identity = 'YES';

    IF actual_count <> 7 THEN
        RAISE EXCEPTION 'Expected 7 identity columns, found %', actual_count;
    END IF;

    SELECT count(*)
      INTO actual_count
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type = 'timestamp with time zone';

    IF actual_count <> 8 THEN
        RAISE EXCEPTION 'Expected 8 TIMESTAMPTZ columns, found %', actual_count;
    END IF;

    SELECT count(*)
      INTO actual_count
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'issues'
       AND column_name = 'metadata'
       AND data_type = 'jsonb';

    IF actual_count <> 1 THEN
        RAISE EXCEPTION 'issues.metadata is not JSONB';
    END IF;

    SELECT count(*)
      INTO actual_count
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = ANY (ARRAY[
           'idx_issues_project_id',
           'idx_issues_status_id',
           'idx_issues_assignee_id',
           'idx_issues_updated_at',
           'idx_comments_issue_id',
           'idx_status_history_issue_id',
           'idx_issue_types_project',
           'idx_workflow_statuses_project'
       ]);

    IF actual_count <> 8 THEN
        RAISE EXCEPTION 'Expected 8 official indexes, found %', actual_count;
    END IF;
END
$$;

SELECT 'schema catalog validation passed' AS result;
