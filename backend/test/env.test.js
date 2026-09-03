const assert = require('node:assert/strict');
const test = require('node:test');

const envModulePath = require.resolve('../src/config/env');
const managedNames = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'COOKIE_SECURE',
  'COOKIE_SAME_SITE',
  'COOKIE_DOMAIN',
  'CORS_ALLOWED_ORIGINS',
  'TRUST_PROXY',
  'DB_POOL_MAX',
  'DB_IDLE_TIMEOUT_MS',
  'DB_CONNECTION_TIMEOUT_MS',
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
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173, https://app.example.com/',
    DB_POOL_MAX: '7',
  });

  assert.equal(env.nodeEnv, 'test');
  assert.equal(env.port, 3100);
  assert.equal(env.cookieSecure, false);
  assert.equal(env.databaseUrl, 'postgres://taskflow:test@db:5432/taskflow_test');
  assert.deepEqual(env.corsAllowedOrigins, ['http://localhost:5173', 'https://app.example.com']);
  assert.equal(env.dbPoolMax, 7);
});

test('requires an explicit CORS origin and encrypted database URL in production', () => {
  assert.throws(
    () => loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://taskflow:test@db:5432/taskflow',
      JWT_SECRET: '01234567890123456789012345678901',
    }),
    /Production DATABASE_URL must require TLS/,
  );

  assert.throws(
    () => loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://taskflow:test@db:5432/taskflow?sslmode=require',
      JWT_SECRET: '01234567890123456789012345678901',
    }),
    /CORS_ALLOWED_ORIGINS is required in production/,
  );
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
