const pool = require('../config/db');

async function listByIssueKey(issueKey, client = pool) {
  const result = await client.query(
    `SELECT comment.id,
            comment.issue_id,
            comment.user_id,
            comment.content,
            comment.created_at,
            comment.updated_at,
            app_user.name AS user_name
       FROM comments AS comment
       JOIN issues AS issue ON issue.id = comment.issue_id
       JOIN users AS app_user ON app_user.id = comment.user_id
      WHERE issue.issue_key = $1
      ORDER BY comment.created_at, comment.id`,
    [issueKey],
  );
  return result.rows;
}

async function create(issueId, userId, content, client = pool) {
  const result = await client.query(
    `INSERT INTO comments (issue_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, issue_id, user_id, content, created_at, updated_at`,
    [issueId, userId, content],
  );
  return result.rows[0];
}

async function findForAuthorization(id, userId, client = pool) {
  const result = await client.query(
    `SELECT comment.id,
            comment.issue_id,
            comment.user_id,
            issue.project_id,
            member.project_role
       FROM comments AS comment
       JOIN issues AS issue ON issue.id = comment.issue_id
       LEFT JOIN project_members AS member
         ON member.project_id = issue.project_id
        AND member.user_id = $2
      WHERE comment.id = $1`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

async function update(id, content, client = pool) {
  const result = await client.query(
    `UPDATE comments
        SET content = $2,
            updated_at = now()
      WHERE id = $1
      RETURNING id, issue_id, user_id, content, created_at, updated_at`,
    [id, content],
  );
  return result.rows[0] ?? null;
}

async function remove(id, client = pool) {
  const result = await client.query('DELETE FROM comments WHERE id = $1 RETURNING id', [id]);
  return result.rowCount === 1;
}

module.exports = {
  create,
  findForAuthorization,
  listByIssueKey,
  remove,
  update,
};
