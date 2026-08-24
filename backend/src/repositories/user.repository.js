const pool = require('../config/db');

const publicColumns = 'id, name, email, account_role, created_at, deactivated_at, deactivated_by';

async function create({ name, email, passwordHash, accountRole = 'member' }, client = pool) {
  const result = await client.query(
    `INSERT INTO users (name, email, password_hash, account_role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${publicColumns}`,
    [name, email, passwordHash, accountRole],
  );
  return result.rows[0];
}

async function findByEmail(email, client = pool) {
  const result = await client.query(
    `SELECT id, name, email, password_hash, account_role, created_at, deactivated_at, deactivated_by
       FROM users
      WHERE email = $1
        AND deactivated_at IS NULL`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function findById(id, client = pool) {
  const result = await client.query(
    `SELECT ${publicColumns}
       FROM users
      WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function findWithPasswordById(id, client = pool) {
  const result = await client.query('SELECT id, name, email, password_hash, account_role, created_at, deactivated_at, deactivated_by FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

async function updatePasswordHash(id, passwordHash, client = pool) {
  return (await client.query('UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id', [id, passwordHash])).rowCount === 1;
}

async function search(search = '', client = pool) {
  const result = await client.query(
    `SELECT ${publicColumns}
       FROM users
      WHERE deactivated_at IS NULL
        AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
      ORDER BY name, email
      LIMIT 50`,
    [search],
  );
  return result.rows;
}

async function findExistingIds(ids, client = pool) {
  if (!ids.length) return [];
  return (await client.query('SELECT id FROM users WHERE id = ANY($1::int[]) AND deactivated_at IS NULL ORDER BY id', [ids])).rows.map((row) => row.id);
}

async function findForUpdate(id, client = pool) {
  return (await client.query(`SELECT ${publicColumns} FROM users WHERE id = $1 FOR UPDATE`, [id])).rows[0] ?? null;
}

async function updateAccountRole(id, accountRole, client = pool) {
  return (await client.query(`UPDATE users SET account_role = $2 WHERE id = $1 RETURNING ${publicColumns}`, [id, accountRole])).rows[0] ?? null;
}

async function downgradeAdminMemberships(id, client = pool) {
  return (await client.query(`UPDATE project_members SET project_role = 'member' WHERE user_id = $1 AND project_role = 'admin'`, [id])).rowCount;
}

async function deactivate(id, actorId, client = pool) {
  return (await client.query(
    `UPDATE users
        SET deactivated_at = now(), deactivated_by = $2
      WHERE id = $1 AND deactivated_at IS NULL
      RETURNING ${publicColumns}`,
    [id, actorId],
  )).rows[0] ?? null;
}

async function removeMemberships(id, client = pool) {
  return (await client.query('DELETE FROM project_members WHERE user_id = $1', [id])).rowCount;
}

module.exports = {
  create,
  deactivate,
  downgradeAdminMemberships,
  findByEmail,
  findById,
  findWithPasswordById,
  findExistingIds,
  findForUpdate,
  search,
  removeMemberships,
  updateAccountRole,
  updatePasswordHash,
};
