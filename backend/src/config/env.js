const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env'),
  quiet: true,
});

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(value) {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseBoolean(name, value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`${name} must be either true or false`);
}

function parseInteger(name, value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function parseOrigins(value, nodeEnv) {
  const origins = (value ?? (nodeEnv === 'production' ? '' : 'http://localhost:5173'))
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins');
    }
  }
  if (nodeEnv === 'production' && origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production');
  }
  return Object.freeze(origins);
}

function parseSameSite(value) {
  const sameSite = value?.trim().toLowerCase() || 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
  }
  return sameSite;
}

function validateDatabaseUrl(value, nodeEnv) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
  }
  if (nodeEnv === 'production') {
    const sslMode = url.searchParams.get('sslmode');
    if (!['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      throw new Error('Production DATABASE_URL must require TLS with sslmode=require, verify-ca, or verify-full');
    }
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production');
}

const jwtSecret = requireValue('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

const databaseUrl = validateDatabaseUrl(requireValue('DATABASE_URL'), nodeEnv);
const cookieSecure = parseBoolean('COOKIE_SECURE', process.env.COOKIE_SECURE, nodeEnv === 'production');
const cookieSameSite = parseSameSite(process.env.COOKIE_SAME_SITE);
if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none');
}

module.exports = Object.freeze({
  nodeEnv,
  port: parsePort(process.env.PORT),
  databaseUrl,
  jwtSecret,
  cookieSecure,
  cookieSameSite,
  cookieDomain: process.env.COOKIE_DOMAIN?.trim() || null,
  corsAllowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS, nodeEnv),
  trustProxy: parseBoolean('TRUST_PROXY', process.env.TRUST_PROXY, nodeEnv === 'production'),
  dbPoolMax: parseInteger('DB_POOL_MAX', process.env.DB_POOL_MAX, 10, { min: 1, max: 100 }),
  dbIdleTimeoutMs: parseInteger('DB_IDLE_TIMEOUT_MS', process.env.DB_IDLE_TIMEOUT_MS, 30000, { min: 1000 }),
  dbConnectionTimeoutMs: parseInteger('DB_CONNECTION_TIMEOUT_MS', process.env.DB_CONNECTION_TIMEOUT_MS, 10000, { min: 1000 }),
  hostFingerprint: process.env.HOST_FINGERPRINT?.trim() || null,
  licenseKey: process.env.LICENSE_KEY?.trim() || null,
});
