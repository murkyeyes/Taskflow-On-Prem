const pool = require('../config/db');

async function list(projectId, client = pool) {
  const result = await client.query(
    `SELECT id, project_id, name, position, is_default, is_final
       FROM workflow_statuses
      WHERE project_id = $1
      ORDER BY position, id`,
    [projectId],
  );
  return result.rows;
}

async function create(projectId, status, client = pool) {
  const result = await client.query(
    `INSERT INTO workflow_statuses (project_id, name, position, is_default, is_final)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, project_id, name, position, is_default, is_final`,
    [projectId, status.name, status.position, status.isDefault ?? false, status.isFinal ?? false],
  );
  return result.rows[0];
}

async function findById(projectId, id, client = pool) {
  const result = await client.query(
    `SELECT id, project_id, name, position, is_default, is_final
       FROM workflow_statuses
      WHERE project_id = $1
        AND id = $2`,
    [projectId, id],
  );
  return result.rows[0] ?? null;
}

async function findDefault(projectId, client = pool) {
  const result = await client.query(
    `SELECT id, project_id, name, position, is_default, is_final
       FROM workflow_statuses
      WHERE project_id = $1
        AND is_default = true
      ORDER BY position, id
      LIMIT 1`,
    [projectId],
  );
  return result.rows[0] ?? null;
}

async function clearDefault(projectId, client = pool) {
  await client.query(
    `UPDATE workflow_statuses
        SET is_default = false
      WHERE project_id = $1
        AND is_default = true`,
    [projectId],
  );
}

async function update(projectId, id, changes, client = pool) {
  const result = await client.query(
    `UPDATE workflow_statuses
        SET name = CASE WHEN $3 THEN $4 ELSE name END,
            position = CASE WHEN $5 THEN $6 ELSE position END,
            is_default = CASE WHEN $7 THEN $8 ELSE is_default END,
            is_final = CASE WHEN $9 THEN $10 ELSE is_final END
      WHERE project_id = $1
        AND id = $2
      RETURNING id, project_id, name, position, is_default, is_final`,
    [
      projectId,
      id,
      Object.hasOwn(changes, 'name'),
      changes.name ?? null,
      Object.hasOwn(changes, 'position'),
      changes.position ?? null,
      Object.hasOwn(changes, 'isDefault'),
      changes.isDefault ?? null,
      Object.hasOwn(changes, 'isFinal'),
      changes.isFinal ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

async function updatePosition(projectId, id, position, client = pool) {
  const result = await client.query(
    `UPDATE workflow_statuses
        SET position = $3
      WHERE project_id = $1
        AND id = $2
      RETURNING id`,
    [projectId, id, position],
  );
  return result.rowCount === 1;
}

async function remove(projectId, id, client = pool) {
  const result = await client.query(
    `DELETE FROM workflow_statuses
      WHERE project_id = $1
        AND id = $2
      RETURNING id`,
    [projectId, id],
  );
  return result.rowCount === 1;
}

module.exports = {
  clearDefault,
  create,
  findById,
  findDefault,
  list,
  remove,
  update,
  updatePosition,
};
