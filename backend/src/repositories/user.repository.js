const pool = require('../config/db');

const publicColumns = 'id, name, email, created_at';

async function create({ name, email, passwordHash }, client = pool) {
  const result = await client.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${publicColumns}`,
    [name, email, passwordHash],
  );
  return result.rows[0];
}

async function findByEmail(email, client = pool) {
  const result = await client.query(
    `SELECT id, name, email, password_hash, created_at
       FROM users
      WHERE email = $1`,
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
  const result = await client.query('SELECT id, name, email, password_hash, created_at FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

async function updatePasswordHash(id, passwordHash, client = pool) {
  return (await client.query('UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id', [id, passwordHash])).rowCount === 1;
}

async function search(search = '', client = pool) {
  const result = await client.query(
    `SELECT ${publicColumns}
       FROM users
      WHERE $1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
      ORDER BY name, email
      LIMIT 50`,
    [search],
  );
  return result.rows;
}

async function findExistingIds(ids, client = pool) {
  if (!ids.length) return [];
  return (await client.query('SELECT id FROM users WHERE id = ANY($1::int[]) ORDER BY id', [ids])).rows.map((row) => row.id);
}

module.exports = {
  create,
  findByEmail,
  findById,
  findWithPasswordById,
  findExistingIds,
  search,
  updatePasswordHash,
};
