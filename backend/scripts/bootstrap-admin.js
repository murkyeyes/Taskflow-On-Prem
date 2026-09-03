const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validateInput({ databaseUrl, name, email, password }) {
  if (name.length > 120) throw new Error('BOOTSTRAP_ADMIN_NAME must be at most 120 characters');
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) throw new Error('BOOTSTRAP_ADMIN_EMAIL is invalid');
  if (password.length < 12 || password.length > 72) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain 12 to 72 characters');
  }
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must be PostgreSQL');
  if (!['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) {
    throw new Error('DATABASE_URL must require TLS');
  }
}

async function createBootstrapAdmin(input, { PoolClass = Pool, hashPassword = (value) => bcrypt.hash(value, 12) } = {}) {
  validateInput(input);
  const { databaseUrl, name, email, password } = input;
  const passwordHash = await hashPassword(password);
  const pool = new PoolClass({ connectionString: databaseUrl, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await client.query(
      "SELECT id FROM users WHERE account_role = 'overall_admin' FOR UPDATE",
    );
    if (existing.rowCount) throw new Error('An Overall Admin already exists');
    await client.query(
      `INSERT INTO users (name, email, password_hash, account_role)
       VALUES ($1, $2, $3, 'overall_admin')`,
      [name, email, passwordHash],
    );
    await client.query('COMMIT');
    console.log(`Overall Admin created for ${email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

async function main() {
  await createBootstrapAdmin({
    databaseUrl: required('DATABASE_URL'),
    name: required('BOOTSTRAP_ADMIN_NAME'),
    email: required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase(),
    password: required('BOOTSTRAP_ADMIN_PASSWORD'),
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { createBootstrapAdmin, validateInput };
