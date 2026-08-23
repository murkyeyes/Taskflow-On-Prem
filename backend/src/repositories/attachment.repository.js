const pool = require('../config/db');

const metadataColumns = `attachment.id,
                         attachment.issue_id,
                         attachment.uploaded_by,
                         attachment.file_name,
                         attachment.media_type,
                         attachment.file_size,
                         attachment.created_at`;

async function listByIssueKey(issueKey, client = pool) {
  const result = await client.query(
    `SELECT ${metadataColumns}, app_user.name AS uploaded_by_name
       FROM issue_attachments AS attachment
       JOIN issues AS issue ON issue.id = attachment.issue_id
       JOIN users AS app_user ON app_user.id = attachment.uploaded_by
      WHERE issue.issue_key = $1
      ORDER BY attachment.created_at DESC, attachment.id DESC`,
    [issueKey],
  );
  return result.rows;
}

async function create(data, client = pool) {
  const result = await client.query(
    `INSERT INTO issue_attachments
       (issue_id, uploaded_by, file_name, media_type, file_size, file_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, issue_id, uploaded_by, file_name, media_type, file_size, created_at`,
    [data.issueId, data.uploadedBy, data.fileName, data.mediaType, data.fileSize, data.fileData],
  );
  return result.rows[0];
}

async function findById(id, { includeData = false } = {}, client = pool) {
  const result = await client.query(
    `SELECT ${metadataColumns},
            issue.project_id,
            issue.status_id
            ${includeData ? ', attachment.file_data' : ''}
       FROM issue_attachments AS attachment
       JOIN issues AS issue ON issue.id = attachment.issue_id
      WHERE attachment.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function remove(id, client = pool) {
  const result = await client.query('DELETE FROM issue_attachments WHERE id = $1 RETURNING id', [id]);
  return result.rowCount === 1;
}

module.exports = { create, findById, listByIssueKey, remove };
