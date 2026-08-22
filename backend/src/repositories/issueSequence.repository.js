async function incrementAndGet(client, projectId) {
  const result = await client.query(
    `UPDATE project_issue_sequences
        SET last_number = last_number + 1
      WHERE project_id = $1
      RETURNING last_number`,
    [projectId],
  );

  if (result.rowCount !== 1) {
    const error = new Error('Project issue sequence not found');
    error.code = 'PROJECT_ISSUE_SEQUENCE_NOT_FOUND';
    throw error;
  }

  return result.rows[0].last_number;
}

async function initialize(client, projectId) {
  await client.query(
    `INSERT INTO project_issue_sequences (project_id, last_number)
     VALUES ($1, 0)`,
    [projectId],
  );
}

module.exports = {
  incrementAndGet,
  initialize,
};
