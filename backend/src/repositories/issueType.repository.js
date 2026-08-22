const pool = require('../config/db');

async function list(projectId, client = pool) {
  const result = await client.query(
    `SELECT id, project_id, name, color
       FROM issue_types
      WHERE project_id = $1
      ORDER BY id`,
    [projectId],
  );
  return result.rows;
}

async function create(projectId, { name, color }, client = pool) {
  const result = await client.query(
    `INSERT INTO issue_types (project_id, name, color)
     VALUES ($1, $2, $3)
     RETURNING id, project_id, name, color`,
    [projectId, name, color ?? null],
  );
  return result.rows[0];
}

async function findById(projectId, id, client = pool) {
  const result = await client.query(
    `SELECT id, project_id, name, color
       FROM issue_types
      WHERE project_id = $1
        AND id = $2`,
    [projectId, id],
  );
  return result.rows[0] ?? null;
}

async function update(projectId, id, changes, client = pool) {
  const hasColor = Object.hasOwn(changes, 'color');
  const result = await client.query(
    `UPDATE issue_types
        SET name = COALESCE($3, name),
            color = CASE WHEN $4 THEN $5 ELSE color END
      WHERE project_id = $1
        AND id = $2
      RETURNING id, project_id, name, color`,
    [projectId, id, changes.name ?? null, hasColor, changes.color ?? null],
  );
  return result.rows[0] ?? null;
}

async function remove(projectId, id, client = pool) {
  const result = await client.query(
    `DELETE FROM issue_types
      WHERE project_id = $1
        AND id = $2
      RETURNING id`,
    [projectId, id],
  );
  return result.rowCount === 1;
}

module.exports = {
  create,
  findById,
  list,
  remove,
  update,
};
