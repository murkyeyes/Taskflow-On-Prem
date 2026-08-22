const assert = require('node:assert/strict');
const test = require('node:test');

process.env.DATABASE_URL ||= 'postgres://taskflow:test@db:5432/taskflow_test';
process.env.JWT_SECRET ||= '01234567890123456789012345678901';

const withTransaction = require('../src/utils/withTransaction');

function createFakePool() {
  const statements = [];
  let released = false;
  const client = {
    async query(sql) {
      statements.push(sql);
    },
    release() {
      released = true;
    },
  };

  return {
    pool: { async connect() { return client; } },
    client,
    statements,
    wasReleased: () => released,
  };
}

test('commits and releases after successful work', async () => {
  const fake = createFakePool();
  const result = await withTransaction(async (client) => {
    assert.equal(client, fake.client);
    return 'done';
  }, fake.pool);

  assert.equal(result, 'done');
  assert.deepEqual(fake.statements, ['BEGIN', 'COMMIT']);
  assert.equal(fake.wasReleased(), true);
});

test('rolls back and releases after failed work', async () => {
  const fake = createFakePool();
  const expectedError = new Error('insert failed');

  await assert.rejects(
    withTransaction(async () => { throw expectedError; }, fake.pool),
    expectedError,
  );

  assert.deepEqual(fake.statements, ['BEGIN', 'ROLLBACK']);
  assert.equal(fake.wasReleased(), true);
});
