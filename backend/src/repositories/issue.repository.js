const pool = require('../config/db');

const issueColumns = `issue.id,
                      issue.project_id,
                      issue.issue_key,
                      issue.title,
                      issue.description,
                      issue.issue_type_id,
                      issue.status_id,
                      issue.reporter_id,
                      issue.assignee_id,
                      issue.priority,
                      issue.metadata,
                      issue.sprint_id,
                      issue.due_date,
                      issue.story_points,
                      issue.backlog_rank,
                      issue.created_at,
                      issue.updated_at`;

async function list(projectId, filters, pagination, client = pool) {
  const conditions = ['issue.project_id = $1'];
  const values = [projectId];
  for (const [column, value] of [
    ['status_id', filters.statusId],
    ['assignee_id', filters.assigneeId],
    ['issue_type_id', filters.issueTypeId],
  ]) {
    if (value !== null) {
      values.push(value);
      conditions.push(`issue.${column} = $${values.length}`);
    }
  }

  const where = conditions.join(' AND ');
  const countResult = await client.query(
    `SELECT count(*)::int AS total
       FROM issues AS issue
      WHERE ${where}`,
    values,
  );
  values.push(pagination.pageSize, (pagination.page - 1) * pagination.pageSize);
  const result = await client.query(
    `SELECT ${issueColumns}
       FROM issues AS issue
      WHERE ${where}
      ORDER BY issue.backlog_rank, issue.created_at DESC, issue.id DESC
      LIMIT $${values.length - 1}
     OFFSET $${values.length}`,
    values,
  );
  return { issues: result.rows, total: countResult.rows[0].total };
}

async function create(data, client = pool) {
  const result = await client.query(
    `INSERT INTO issues (
        project_id, issue_key, title, description, issue_type_id,
        status_id, reporter_id, assignee_id, priority, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, project_id, issue_key, title, description, issue_type_id,
               status_id, reporter_id, assignee_id, priority, metadata,
               created_at, updated_at`,
    [
      data.projectId,
      data.issueKey,
      data.title,
      data.description,
      data.issueTypeId,
      data.statusId,
      data.reporterId,
      data.assigneeId,
      data.priority,
      data.metadata,
    ],
  );
  return result.rows[0];
}

async function findByKey(issueKey, client = pool) {
  const result = await client.query(
    `SELECT ${issueColumns}
       FROM issues AS issue
      WHERE issue.issue_key = $1`,
    [issueKey],
  );
  return result.rows[0] ?? null;
}

async function lockByKey(issueKey, client = pool) {
  const result = await client.query(
    `SELECT ${issueColumns}
       FROM issues AS issue
      WHERE issue.issue_key = $1
      FOR UPDATE`,
    [issueKey],
  );
  return result.rows[0] ?? null;
}

async function update(issueKey, changes, client = pool) {
  const result = await client.query(
    `UPDATE issues
        SET title = CASE WHEN $2 THEN $3 ELSE title END,
            description = CASE WHEN $4 THEN $5 ELSE description END,
            assignee_id = CASE WHEN $6 THEN $7 ELSE assignee_id END,
            priority = CASE WHEN $8 THEN $9 ELSE priority END,
            issue_type_id = CASE WHEN $10 THEN $11 ELSE issue_type_id END,
            updated_at = now()
      WHERE issue_key = $1
      RETURNING id, project_id, issue_key, title, description, issue_type_id,
                status_id, reporter_id, assignee_id, priority, metadata,
                created_at, updated_at`,
    [
      issueKey,
      Object.hasOwn(changes, 'title'), changes.title ?? null,
      Object.hasOwn(changes, 'description'), changes.description ?? null,
      Object.hasOwn(changes, 'assigneeId'), changes.assigneeId ?? null,
      Object.hasOwn(changes, 'priority'), changes.priority ?? null,
      Object.hasOwn(changes, 'issueTypeId'), changes.issueTypeId ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

async function updateStatus(issueKey, statusId, client = pool) {
  const result = await client.query(
    `UPDATE issues
        SET status_id = $2,
            updated_at = now()
      WHERE issue_key = $1
      RETURNING id, project_id, issue_key, title, description, issue_type_id,
                status_id, reporter_id, assignee_id, priority, metadata,
                created_at, updated_at`,
    [issueKey, statusId],
  );
  return result.rows[0] ?? null;
}

async function touch(issueId, client = pool) {
  await client.query('UPDATE issues SET updated_at = now() WHERE id = $1', [issueId]);
}

async function remove(issueKey, client = pool) {
  const result = await client.query(
    'DELETE FROM issues WHERE issue_key = $1 RETURNING id',
    [issueKey],
  );
  return result.rowCount === 1;
}

module.exports = {
  create,
  findByKey,
  list,
  lockByKey,
  remove,
  touch,
  update,
  updateStatus,
};
