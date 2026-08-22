const pool = require('../config/db');

async function create({ issueId, fromStatusId, toStatusId, changedBy }, client = pool) {
  const result = await client.query(
    `INSERT INTO issue_status_history (issue_id, from_status_id, to_status_id, changed_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, issue_id, from_status_id, to_status_id, changed_by, changed_at`,
    [issueId, fromStatusId, toStatusId, changedBy],
  );
  return result.rows[0];
}

module.exports = {
  create,
};
