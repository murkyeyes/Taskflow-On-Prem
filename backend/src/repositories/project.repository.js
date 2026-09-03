const pool = require('../config/db');

async function listForUser(userId, client = pool) {
  const result = await client.query(
    `WITH account_access AS (
       SELECT account_role IN ('overall_admin','admin') AS is_admin FROM users WHERE id = $1
     )
     SELECT project.id,
            project.key,
            project.name,
            project.description,
            project.created_by,
            project.created_at,
            project.template_key,
            project.enabled_features,
            CASE WHEN account_access.is_admin THEN 'admin' ELSE member.project_role END AS project_role
       FROM projects AS project
       CROSS JOIN account_access
       LEFT JOIN project_members AS member
         ON member.project_id = project.id
        AND member.user_id = $1
      WHERE project.deleted_at IS NULL
        AND (account_access.is_admin OR member.user_id IS NOT NULL)
      ORDER BY project.name, project.id`,
    [userId],
  );
  return result.rows;
}

async function create({ key, name, description, createdBy, templateKey = 'kanban', enabledFeatures = ['summary','backlog','board','development','timeline','docs','forms'] }, client = pool) {
  const result = await client.query(
    `INSERT INTO projects (key, name, description, created_by, template_key, enabled_features)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, key, name, description, created_by, created_at, template_key, enabled_features`,
    [key, name, description, createdBy, templateKey, JSON.stringify(enabledFeatures)],
  );
  return result.rows[0];
}

async function findById(projectId, client = pool) {
  const result = await client.query(
    `SELECT id, key, name, description, created_by, created_at, template_key, enabled_features
       FROM projects
      WHERE id = $1
        AND deleted_at IS NULL`,
    [projectId],
  );
  return result.rows[0] ?? null;
}

async function lockById(projectId, client = pool) {
  const result = await client.query(
    `SELECT id, key, name, description, created_by, created_at, template_key, enabled_features
       FROM projects
      WHERE id = $1
        AND deleted_at IS NULL
      FOR UPDATE`,
    [projectId],
  );
  return result.rows[0] ?? null;
}

async function update(projectId, changes, client = pool) {
  const hasDescription = Object.hasOwn(changes, 'description');
  const hasFeatures = Object.hasOwn(changes, 'enabledFeatures');
  const result = await client.query(
    `UPDATE projects
        SET name = COALESCE($2, name),
            description = CASE WHEN $3 THEN $4 ELSE description END,
            enabled_features = CASE WHEN $5 THEN $6::jsonb ELSE enabled_features END
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, key, name, description, created_by, created_at, template_key, enabled_features`,
    [projectId, changes.name ?? null, hasDescription, changes.description ?? null, hasFeatures, JSON.stringify(changes.enabledFeatures ?? [])],
  );
  return result.rows[0] ?? null;
}

async function softDelete(projectId, deletedBy, client = pool) {
  const result = await client.query(
    `UPDATE projects
        SET deleted_at = now(),
            deleted_by = $2
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id`,
    [projectId, deletedBy],
  );
  return result.rowCount === 1;
}

module.exports = {
  create,
  findById,
  listForUser,
  lockById,
  softDelete,
  update,
};
