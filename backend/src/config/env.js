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

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production');
}

const jwtSecret = requireValue('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

module.exports = Object.freeze({
  nodeEnv,
  port: parsePort(process.env.PORT),
  databaseUrl: requireValue('DATABASE_URL'),
  jwtSecret,
  cookieSecure: parseBoolean('COOKIE_SECURE', process.env.COOKIE_SECURE, nodeEnv === 'production'),
  hostFingerprint: process.env.HOST_FINGERPRINT?.trim() || null,
  licenseKey: process.env.LICENSE_KEY?.trim() || null,
});
