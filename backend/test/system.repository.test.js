const assert = require('node:assert/strict');
const test = require('node:test');

process.env.DATABASE_URL ||= 'postgres://taskflow:test@db:5432/taskflow_test';
process.env.JWT_SECRET ||= '01234567890123456789012345678901';

const systemRepository = require('../src/repositories/system.repository');

test('connection probe acquires and releases a pool client', async () => {
  let released = false;
  const fakePool = {
    async connect() {
      return { release() { released = true; } };
    },
  };

  assert.equal(await systemRepository.checkConnection(fakePool), true);
  assert.equal(released, true);
});
