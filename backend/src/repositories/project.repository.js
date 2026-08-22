const pool = require('../config/db');

async function listForUser(userId, client = pool) {
  const result = await client.query(
    `WITH account_access AS (
       SELECT EXISTS (
         SELECT 1
           FROM project_members
          WHERE user_id = $1
            AND project_role = 'admin'
       ) AS is_admin
     )
     SELECT project.id,
            project.key,
            project.name,
            project.description,
            project.created_by,
            project.created_at,
            CASE WHEN account_access.is_admin THEN 'admin' ELSE member.project_role END AS project_role
       FROM projects AS project
       CROSS JOIN account_access
       LEFT JOIN project_members AS member
         ON member.project_id = project.id
        AND member.user_id = $1
      WHERE account_access.is_admin OR member.user_id IS NOT NULL
      ORDER BY project.name, project.id`,
    [userId],
  );
  return result.rows;
}

async function create({ key, name, description, createdBy }, client = pool) {
  const result = await client.query(
    `INSERT INTO projects (key, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, key, name, description, created_by, created_at`,
    [key, name, description, createdBy],
  );
  return result.rows[0];
}

async function findById(projectId, client = pool) {
  const result = await client.query(
    `SELECT id, key, name, description, created_by, created_at
       FROM projects
      WHERE id = $1`,
    [projectId],
  );
  return result.rows[0] ?? null;
}

async function lockById(projectId, client = pool) {
  const result = await client.query(
    `SELECT id, key, name, description, created_by, created_at
       FROM projects
      WHERE id = $1
      FOR UPDATE`,
    [projectId],
  );
  return result.rows[0] ?? null;
}

async function update(projectId, changes, client = pool) {
  const hasDescription = Object.hasOwn(changes, 'description');
  const result = await client.query(
    `UPDATE projects
        SET name = COALESCE($2, name),
            description = CASE WHEN $3 THEN $4 ELSE description END
      WHERE id = $1
      RETURNING id, key, name, description, created_by, created_at`,
    [projectId, changes.name ?? null, hasDescription, changes.description ?? null],
  );
  return result.rows[0] ?? null;
}

async function remove(projectId, client = pool) {
  const result = await client.query(
    'DELETE FROM projects WHERE id = $1 RETURNING id',
    [projectId],
  );
  return result.rowCount === 1;
}

module.exports = {
  create,
  findById,
  listForUser,
  lockById,
  remove,
  update,
};
