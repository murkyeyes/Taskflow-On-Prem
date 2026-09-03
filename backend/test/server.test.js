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

test('allows credentialed preflight only for a configured origin', async (context) => {
  const server = startServer(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const allowed = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:5173' },
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  const denied = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { origin: 'https://evil.example' },
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, 'CORS_ORIGIN_DENIED');
});

test('marks API responses as non-cacheable at the application boundary', async (context) => {
  const server = startServer(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/not-found`);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
