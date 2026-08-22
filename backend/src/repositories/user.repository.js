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

module.exports = {
  create,
  findByEmail,
  findById,
};
