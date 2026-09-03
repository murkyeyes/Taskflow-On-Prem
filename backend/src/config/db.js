const { Pool } = require('pg');

const env = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  idleTimeoutMillis: env.dbIdleTimeoutMs,
  connectionTimeoutMillis: env.dbConnectionTimeoutMs,
  keepAlive: true,
});

module.exports = pool;
