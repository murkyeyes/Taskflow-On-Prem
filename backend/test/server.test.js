const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgres://taskflow:test@db:5432/taskflow_test';
process.env.JWT_SECRET ||= '01234567890123456789012345678901';

const app = require('../src/app');
const startServer = require('../src/server');

test('exports an Express app and starts on an ephemeral port', async (context) => {
  assert.equal(typeof app, 'function');

  const server = startServer(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.equal(typeof address.port, 'number');
  assert.ok(address.port > 0);
});
