const pool = require('../config/db');

async function checkConnection(databasePool = pool) {
  const client = await databasePool.connect();
  try {
    return true;
  } finally {
    client.release();
  }
}

module.exports = {
  checkConnection,
};
