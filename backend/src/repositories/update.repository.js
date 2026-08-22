const pool = require('../config/db');

async function getServerTime(client = pool) {
  const result = await client.query('SELECT clock_timestamp() AS server_time');
  return result.rows[0].server_time;
}

async function findChangedIssues(projectId, since, until, client = pool) {
  const result = await client.query(
    `SELECT id, project_id, issue_key, title, description, issue_type_id,
            status_id, reporter_id, assignee_id, priority, metadata,
            created_at, updated_at
       FROM issues
      WHERE project_id = $1
        AND updated_at > $2
        AND updated_at <= $3
      ORDER BY updated_at, id`,
    [projectId, since, until],
  );
  return result.rows;
}

async function findNewComments(projectId, since, until, client = pool) {
  const result = await client.query(
    `SELECT comment.id,
            comment.issue_id,
            comment.user_id,
            comment.content,
            comment.created_at,
            comment.updated_at
       FROM comments AS comment
       JOIN issues AS issue ON issue.id = comment.issue_id
      WHERE issue.project_id = $1
        AND comment.created_at > $2
        AND comment.created_at <= $3
      ORDER BY comment.created_at, comment.id`,
    [projectId, since, until],
  );
  return result.rows;
}

module.exports = {
  findChangedIssues,
  findNewComments,
  getServerTime,
};
