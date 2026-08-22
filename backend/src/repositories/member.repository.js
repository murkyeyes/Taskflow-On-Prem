const pool = require('../config/db');

async function findRoleByProjectId(projectId, userId, client = pool) {
  const result = await client.query(
    `SELECT project_id, project_role
       FROM project_members
      WHERE project_id = $1
        AND user_id = $2`,
    [projectId, userId],
  );
  return result.rows[0] ?? null;
}

async function findRoleByIssueKey(issueKey, userId, client = pool) {
  const result = await client.query(
    `SELECT issue.project_id, member.project_role
       FROM issues AS issue
       JOIN project_members AS member
         ON member.project_id = issue.project_id
        AND member.user_id = $2
      WHERE issue.issue_key = $1`,
    [issueKey, userId],
  );
  return result.rows[0] ?? null;
}

async function list(projectId, client = pool) {
  const result = await client.query(
    `SELECT member.project_id,
            member.user_id,
            member.project_role,
            member.joined_at,
            app_user.name,
            app_user.email
       FROM project_members AS member
       JOIN users AS app_user ON app_user.id = member.user_id
      WHERE member.project_id = $1
      ORDER BY app_user.name, member.user_id`,
    [projectId],
  );
  return result.rows;
}

async function add(projectId, userId, projectRole, client = pool) {
  const result = await client.query(
    `INSERT INTO project_members (project_id, user_id, project_role)
     VALUES ($1, $2, $3)
     RETURNING project_id, user_id, project_role, joined_at`,
    [projectId, userId, projectRole],
  );
  return result.rows[0];
}

async function updateRole(projectId, userId, projectRole, client = pool) {
  const result = await client.query(
    `UPDATE project_members
        SET project_role = $3
      WHERE project_id = $1
        AND user_id = $2
      RETURNING project_id, user_id, project_role, joined_at`,
    [projectId, userId, projectRole],
  );
  return result.rows[0] ?? null;
}

async function remove(projectId, userId, client = pool) {
  const result = await client.query(
    `DELETE FROM project_members
      WHERE project_id = $1
        AND user_id = $2
      RETURNING user_id`,
    [projectId, userId],
  );
  return result.rowCount === 1;
}

module.exports = {
  add,
  findRoleByIssueKey,
  findRoleByProjectId,
  list,
  remove,
  updateRole,
};
