const assert = require('node:assert/strict');
const test = require('node:test');

const envModulePath = require.resolve('../src/config/env');
const managedNames = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'COOKIE_SECURE',
];

function loadEnv(overrides) {
  const original = Object.fromEntries(managedNames.map((name) => [name, process.env[name]]));
  for (const name of managedNames) {
    delete process.env[name];
  }
  Object.assign(process.env, overrides);
  delete require.cache[envModulePath];

  try {
    return require(envModulePath);
  } finally {
    for (const name of managedNames) {
      if (original[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = original[name];
      }
    }
    delete require.cache[envModulePath];
  }
}

test('loads and normalizes valid environment values', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '3100',
    DATABASE_URL: 'postgres://taskflow:test@db:5432/taskflow_test',
    JWT_SECRET: '01234567890123456789012345678901',
    COOKIE_SECURE: 'false',
  });

  assert.equal(env.nodeEnv, 'test');
  assert.equal(env.port, 3100);
  assert.equal(env.cookieSecure, false);
  assert.equal(env.databaseUrl, 'postgres://taskflow:test@db:5432/taskflow_test');
});

test('rejects a missing database URL', () => {
  assert.throws(
    () => loadEnv({ DATABASE_URL: ' ', JWT_SECRET: '01234567890123456789012345678901' }),
    /Missing required environment variable: DATABASE_URL/,
  );
});

test('rejects a short JWT secret', () => {
  assert.throws(
    () => loadEnv({ DATABASE_URL: 'postgres://taskflow:test@db:5432/taskflow_test', JWT_SECRET: 'short' }),
    /JWT_SECRET must contain at least 32 characters/,
  );
});
