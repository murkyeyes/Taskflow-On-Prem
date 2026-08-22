#!/bin/sh
set -eu

worker_count="${1:-25}"
database_name="${POSTGRES_DB:-taskflow_test}"
database_user="${POSTGRES_USER:-taskflow}"

before_sequence="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT last_number FROM project_issue_sequences WHERE project_id = (SELECT id FROM projects WHERE key = 'ATX')")"

pids=""
worker_number=1
while [ "$worker_number" -le "$worker_count" ]; do
    psql -U "$database_user" -d "$database_name" -f /tmp/issue-key-concurrent-worker.sql > "/tmp/issue-key-worker-$worker_number.log" 2>&1 &
    pids="$pids $!"
    worker_number=$((worker_number + 1))
done

failed=0
worker_number=1
for pid in $pids; do
    if ! wait "$pid"; then
        echo "Worker $worker_number failed"
        cat "/tmp/issue-key-worker-$worker_number.log"
        failed=1
    fi
    worker_number=$((worker_number + 1))
done

if [ "$failed" -ne 0 ]; then
    exit 1
fi

expected_sequence=$((before_sequence + worker_count))
after_sequence="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT last_number FROM project_issue_sequences WHERE project_id = (SELECT id FROM projects WHERE key = 'ATX')")"
issue_count="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT count(*) FROM issues WHERE project_id = (SELECT id FROM projects WHERE key = 'ATX')")"
distinct_key_count="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT count(DISTINCT issue_key) FROM issues WHERE project_id = (SELECT id FROM projects WHERE key = 'ATX')")"
history_count="$(psql -U "$database_user" -d "$database_name" -Atc "SELECT count(*) FROM issue_status_history WHERE issue_id IN (SELECT id FROM issues WHERE project_id = (SELECT id FROM projects WHERE key = 'ATX')) AND from_status_id IS NULL")"

printf 'workers=%s before=%s after=%s issues=%s distinct_keys=%s initial_history=%s\n' \
    "$worker_count" "$before_sequence" "$after_sequence" "$issue_count" "$distinct_key_count" "$history_count"

if [ "$after_sequence" -ne "$expected_sequence" ] || \
   [ "$issue_count" -ne "$after_sequence" ] || \
   [ "$distinct_key_count" -ne "$issue_count" ] || \
   [ "$history_count" -ne "$issue_count" ]; then
    echo 'Concurrency verification failed'
    exit 1
fi

echo 'Concurrency verification passed'
