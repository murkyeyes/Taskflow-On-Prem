const pool = require('../config/db');

async function getServerTime(client = pool) {
  const result = await client.query('SELECT clock_timestamp() AS server_time');
  return result.rows[0].server_time;
}

async function findChangedIssues(projectId, since, until, client = pool) {
  const result = await client.query(
    `SELECT issue.id, issue.project_id, issue.issue_key, issue.title, issue.description,
            issue.issue_type_id, issue.status_id, issue.reporter_id, issue.assignee_id,
            issue.priority, issue.metadata, issue.sprint_id, issue.due_date,
            issue.story_points, issue.backlog_rank, issue.created_at, issue.completed_at,
            issue.updated_at, assignee.name AS assignee_name
       FROM issues AS issue
       LEFT JOIN users AS assignee ON assignee.id = issue.assignee_id
      WHERE issue.project_id = $1
        AND issue.updated_at > $2
        AND issue.updated_at <= $3
      ORDER BY issue.updated_at, issue.id`,
    [projectId, since, until],
  );
  return result.rows;
}

async function findNewComments(projectId, since, until, client = pool) {
  const result = await client.query(
    `SELECT comment.id,
            comment.issue_id,
            comment.user_id,
            comment.content,
            comment.created_at,
            comment.updated_at
       FROM comments AS comment
       JOIN issues AS issue ON issue.id = comment.issue_id
      WHERE issue.project_id = $1
        AND comment.created_at > $2
        AND comment.created_at <= $3
      ORDER BY comment.created_at, comment.id`,
    [projectId, since, until],
  );
  return result.rows;
}

module.exports = {
  findChangedIssues,
  findNewComments,
  getServerTime,
};
