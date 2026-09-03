const pool = require('../config/db');

async function findRoleByProjectId(projectId, userId, client = pool) {
  const result = await client.query(
    `SELECT member.project_id, member.project_role
       FROM project_members AS member
       JOIN projects AS project ON project.id = member.project_id
      WHERE member.project_id = $1
        AND project.deleted_at IS NULL
        AND member.user_id = $2`,
    [projectId, userId],
  );
  return result.rows[0] ?? null;
}

async function findRoleByIssueKey(issueKey, userId, client = pool) {
  const result = await client.query(
    `SELECT issue.project_id, member.project_role
       FROM issues AS issue
       JOIN projects AS project
         ON project.id = issue.project_id
        AND project.deleted_at IS NULL
       JOIN project_members AS member
         ON member.project_id = issue.project_id
        AND member.user_id = $2
      WHERE issue.issue_key = $1`,
    [issueKey, userId],
  );
  return result.rows[0] ?? null;
}

async function findEffectiveRoleByProjectId(projectId, userId, client = pool) {
  const result = await client.query(
    `WITH account_access AS (
       SELECT account_role IN ('overall_admin','admin') AS is_admin FROM users WHERE id = $2 AND deactivated_at IS NULL
     )
     SELECT project.id AS project_id,
            CASE WHEN account_access.is_admin THEN 'admin' ELSE member.project_role END AS project_role
       FROM projects AS project
       CROSS JOIN account_access
       LEFT JOIN project_members AS member
         ON member.project_id = project.id
        AND member.user_id = $2
      WHERE project.id = $1
        AND project.deleted_at IS NULL
        AND (account_access.is_admin OR member.user_id IS NOT NULL)`,
    [projectId, userId],
  );
  return result.rows[0] ?? null;
}

async function findEffectiveRoleByIssueKey(issueKey, userId, client = pool) {
  const result = await client.query(
    `WITH account_access AS (
       SELECT account_role IN ('overall_admin','admin') AS is_admin FROM users WHERE id = $2 AND deactivated_at IS NULL
     )
     SELECT issue.project_id,
            CASE WHEN account_access.is_admin THEN 'admin' ELSE member.project_role END AS project_role
       FROM issues AS issue
       JOIN projects AS project
         ON project.id = issue.project_id
        AND project.deleted_at IS NULL
       CROSS JOIN account_access
       LEFT JOIN project_members AS member
         ON member.project_id = issue.project_id
        AND member.user_id = $2
      WHERE issue.issue_key = $1
        AND (account_access.is_admin OR member.user_id IS NOT NULL)`,
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
        AND app_user.deactivated_at IS NULL
      ORDER BY app_user.name, member.user_id`,
    [projectId],
  );
  return result.rows;
}

async function searchAssignees(projectId, search = '', client = pool) {
  const result = await client.query(
    `SELECT member.project_id, member.user_id, member.project_role, app_user.name, app_user.email
       FROM project_members AS member
       JOIN users AS app_user ON app_user.id = member.user_id
      WHERE member.project_id = $1
        AND app_user.deactivated_at IS NULL
        AND ($2 = '' OR app_user.name ILIKE '%' || $2 || '%' OR app_user.email ILIKE '%' || $2 || '%')
      ORDER BY app_user.name, app_user.email
      LIMIT 30`,
    [projectId, search],
  );
  return result.rows;
}

async function hasAnyAdminMembership(userId, client = pool) {
  const result = await client.query(
    `SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND deactivated_at IS NULL AND account_role IN ('overall_admin','admin')) AS is_admin`,
    [userId],
  );
  return result.rows[0].is_admin;
}

async function hasOverallAdminRole(userId, client = pool) {
  return (await client.query(`SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND deactivated_at IS NULL AND account_role = 'overall_admin') AS allowed`, [userId])).rows[0].allowed;
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
  findEffectiveRoleByIssueKey,
  findEffectiveRoleByProjectId,
  findRoleByIssueKey,
  findRoleByProjectId,
  hasAnyAdminMembership,
  hasOverallAdminRole,
  list,
  remove,
  updateRole,
  searchAssignees,
};
