#!/bin/sh
set -eu

database_name="${POSTGRES_DB:-taskflow_test}"
database_user="${POSTGRES_USER:-taskflow}"
project_query="SELECT id FROM projects WHERE key = 'ATX'"

before_sequence="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT last_number FROM project_issue_sequences WHERE project_id = ($project_query)")"
before_issues="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT count(*) FROM issues WHERE project_id = ($project_query)")"
before_history="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT count(*) FROM issue_status_history WHERE issue_id IN (SELECT id FROM issues WHERE project_id = ($project_query))")"

if psql -U "$database_user" -d "$database_name" -f /tmp/issue-key-rollback.sql > /tmp/issue-key-rollback.log 2>&1; then
    echo 'Expected the duplicate issue insert to fail, but it succeeded'
    exit 1
fi

after_sequence="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT last_number FROM project_issue_sequences WHERE project_id = ($project_query)")"
after_issues="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT count(*) FROM issues WHERE project_id = ($project_query)")"
after_history="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT count(*) FROM issue_status_history WHERE issue_id IN (SELECT id FROM issues WHERE project_id = ($project_query))")"

printf 'before: sequence=%s issues=%s history=%s\n' "$before_sequence" "$before_issues" "$before_history"
printf 'after:  sequence=%s issues=%s history=%s\n' "$after_sequence" "$after_issues" "$after_history"

if [ "$after_sequence" -ne "$before_sequence" ] || \
   [ "$after_issues" -ne "$before_issues" ] || \
   [ "$after_history" -ne "$before_history" ]; then
    cat /tmp/issue-key-rollback.log
    echo 'Rollback verification failed'
    exit 1
fi

echo 'Rollback verification passed'
