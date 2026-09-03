const assert = require('node:assert/strict');
const test = require('node:test');

const { createBootstrapAdmin, validateInput } = require('../scripts/bootstrap-admin');

const valid = {
  databaseUrl: 'postgres://postgres.project:secret@pooler.example:5432/postgres?sslmode=require',
  name: 'Taskflow Owner',
  email: 'owner@example.com',
  password: 'A-strong-password-123',
};

test('bootstrap validation requires PostgreSQL TLS and a strong initial password', () => {
  assert.doesNotThrow(() => validateInput(valid));
  assert.throws(() => validateInput({ ...valid, databaseUrl: 'postgres://localhost/db' }), /require TLS/);
  assert.throws(() => validateInput({ ...valid, password: 'too-short' }), /12 to 72/);
});

test('bootstrap inserts one hashed Overall Admin in a transaction', async () => {
  const queries = [];
  let released = false;
  let ended = false;
  const client = {
    async query(text, params) {
      queries.push({ text, params });
      if (text.includes("account_role = 'overall_admin'")) return { rowCount: 0 };
      return { rowCount: 1 };
    },
    release() { released = true; },
  };
  class FakePool {
    async connect() { return client; }
    async end() { ended = true; }
  }

  await createBootstrapAdmin(valid, {
    PoolClass: FakePool,
    hashPassword: async () => 'bcrypt-hash',
  });

  assert.equal(queries[0].text, 'BEGIN');
  assert.match(queries[2].text, /INSERT INTO users/);
  assert.deepEqual(queries[2].params, [valid.name, valid.email, 'bcrypt-hash']);
  assert.equal(queries.at(-1).text, 'COMMIT');
  assert.equal(released, true);
  assert.equal(ended, true);
});

test('bootstrap refuses a second Overall Admin and rolls back', async () => {
  const queries = [];
  const client = {
    async query(text) {
      queries.push(text);
      if (text.includes("account_role = 'overall_admin'")) return { rowCount: 1 };
      return { rowCount: 1 };
    },
    release() {},
  };
  class FakePool {
    async connect() { return client; }
    async end() {}
  }

  await assert.rejects(
    createBootstrapAdmin(valid, { PoolClass: FakePool, hashPassword: async () => 'bcrypt-hash' }),
    /already exists/,
  );
  assert.equal(queries.at(-1), 'ROLLBACK');
});
