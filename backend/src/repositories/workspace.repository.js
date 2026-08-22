const pool = require('../config/db');

async function getSummary(projectId, client = pool) {
  const [metrics, statuses, priorities, types, workload, activity] = await Promise.all([
    client.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE ws.is_final)::int AS completed,
              count(*) FILTER (WHERE i.updated_at >= now() - interval '7 days')::int AS updated,
              count(*) FILTER (WHERE i.created_at >= now() - interval '7 days')::int AS created,
              count(*) FILTER (WHERE i.due_date BETWEEN current_date AND current_date + 7 AND NOT ws.is_final)::int AS due_soon
         FROM issues i JOIN workflow_statuses ws ON ws.id = i.status_id
        WHERE i.project_id = $1`,
      [projectId],
    ),
    client.query(
      `SELECT ws.id, ws.name, ws.is_final, ws.position, count(i.id)::int AS count
         FROM workflow_statuses ws LEFT JOIN issues i ON i.status_id = ws.id
        WHERE ws.project_id = $1 GROUP BY ws.id ORDER BY ws.position`, [projectId],
    ),
    client.query(
      `SELECT priority, count(*)::int AS count FROM issues WHERE project_id = $1
        GROUP BY priority ORDER BY array_position(ARRAY['highest','high','medium','low','lowest']::varchar[], priority)`, [projectId],
    ),
    client.query(
      `SELECT it.id, it.name, it.color, count(i.id)::int AS count
         FROM issue_types it LEFT JOIN issues i ON i.issue_type_id = it.id
        WHERE it.project_id = $1 GROUP BY it.id ORDER BY it.name`, [projectId],
    ),
    client.query(
      `SELECT COALESCE(u.id, 0) AS user_id, COALESCE(u.name, 'Unassigned') AS name, count(i.id)::int AS count
         FROM issues i LEFT JOIN users u ON u.id = i.assignee_id
        WHERE i.project_id = $1 GROUP BY u.id, u.name ORDER BY count(i.id) DESC`, [projectId],
    ),
    client.query(
      `SELECT h.changed_at AS occurred_at, u.name AS actor, i.issue_key, i.title,
              'moved to ' || ws.name AS action
         FROM issue_status_history h
         JOIN issues i ON i.id = h.issue_id
         JOIN users u ON u.id = h.changed_by
         JOIN workflow_statuses ws ON ws.id = h.to_status_id
        WHERE i.project_id = $1 ORDER BY h.changed_at DESC LIMIT 12`, [projectId],
    ),
  ]);
  return {
    metrics: metrics.rows[0], statuses: statuses.rows, priorities: priorities.rows,
    types: types.rows, workload: workload.rows, activity: activity.rows,
  };
}

async function listSprints(projectId, client = pool) {
  const result = await client.query(
    `SELECT s.*, count(i.id)::int AS issue_count, COALESCE(sum(i.story_points), 0)::int AS story_points
       FROM sprints s LEFT JOIN issues i ON i.sprint_id = s.id
      WHERE s.project_id = $1 GROUP BY s.id
      ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, s.start_date NULLS LAST, s.id`, [projectId],
  );
  return result.rows;
}

async function lockSprints(projectId, client = pool) {
  await client.query('SELECT id FROM sprints WHERE project_id = $1 FOR UPDATE', [projectId]);
}

async function findSprint(projectId, sprintId, client = pool) {
  const result = await client.query('SELECT * FROM sprints WHERE project_id = $1 AND id = $2', [projectId, sprintId]);
  return result.rows[0] ?? null;
}

async function createSprint(projectId, data, userId, client = pool) {
  const result = await client.query(
    `INSERT INTO sprints (project_id, name, goal, status, start_date, end_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [projectId, data.name, data.goal, data.status, data.startDate, data.endDate, userId],
  );
  return result.rows[0];
}

async function updateSprint(projectId, sprintId, data, client = pool) {
  const result = await client.query(
    `UPDATE sprints SET
       name = CASE WHEN $3 THEN $4 ELSE name END,
       goal = CASE WHEN $5 THEN $6 ELSE goal END,
       status = CASE WHEN $7 THEN $8 ELSE status END,
       start_date = CASE WHEN $9 THEN $10 ELSE start_date END,
       end_date = CASE WHEN $11 THEN $12 ELSE end_date END,
       updated_at = now()
     WHERE project_id = $1 AND id = $2 RETURNING *`,
    [projectId, sprintId,
      Object.hasOwn(data, 'name'), data.name ?? null,
      Object.hasOwn(data, 'goal'), data.goal ?? null,
      Object.hasOwn(data, 'status'), data.status ?? null,
      Object.hasOwn(data, 'startDate'), data.startDate ?? null,
      Object.hasOwn(data, 'endDate'), data.endDate ?? null],
  );
  return result.rows[0] ?? null;
}

async function deleteSprint(projectId, sprintId, client = pool) {
  return (await client.query('DELETE FROM sprints WHERE project_id = $1 AND id = $2 RETURNING id', [projectId, sprintId])).rowCount === 1;
}

async function updatePlanning(issueKey, data, client = pool) {
  const result = await client.query(
    `UPDATE issues SET
       sprint_id = CASE WHEN $2 THEN $3 ELSE sprint_id END,
       due_date = CASE WHEN $4 THEN $5 ELSE due_date END,
       story_points = CASE WHEN $6 THEN $7 ELSE story_points END,
       backlog_rank = CASE WHEN $8 THEN $9 ELSE backlog_rank END,
       updated_at = now()
     WHERE issue_key = $1 RETURNING *`,
    [issueKey,
      Object.hasOwn(data, 'sprintId'), data.sprintId ?? null,
      Object.hasOwn(data, 'dueDate'), data.dueDate ?? null,
      Object.hasOwn(data, 'storyPoints'), data.storyPoints ?? null,
      Object.hasOwn(data, 'backlogRank'), data.backlogRank ?? null],
  );
  return result.rows[0] ?? null;
}

async function listDevelopmentLinks(projectId, client = pool) {
  return (await client.query(
    `SELECT dl.*, i.issue_key, u.name AS created_by_name FROM development_links dl
       LEFT JOIN issues i ON i.id = dl.issue_id JOIN users u ON u.id = dl.created_by
      WHERE dl.project_id = $1 ORDER BY dl.created_at DESC`, [projectId],
  )).rows;
}

async function createDevelopmentLink(projectId, data, userId, client = pool) {
  return (await client.query(
    `INSERT INTO development_links (project_id, issue_id, provider, link_type, title, url, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [projectId, data.issueId, data.provider, data.linkType, data.title, data.url, data.status, userId],
  )).rows[0];
}

async function deleteDevelopmentLink(projectId, linkId, client = pool) {
  return (await client.query('DELETE FROM development_links WHERE project_id = $1 AND id = $2 RETURNING id', [projectId, linkId])).rowCount === 1;
}

async function listDocs(projectId, client = pool) {
  return (await client.query(
    `SELECT d.*, u.name AS updated_by_name FROM project_docs d JOIN users u ON u.id = d.updated_by
      WHERE d.project_id = $1 ORDER BY d.updated_at DESC`, [projectId],
  )).rows;
}

async function findDoc(projectId, docId, client = pool) {
  return (await client.query('SELECT * FROM project_docs WHERE project_id = $1 AND id = $2', [projectId, docId])).rows[0] ?? null;
}

async function createDoc(projectId, data, userId, client = pool) {
  return (await client.query(
    `INSERT INTO project_docs (project_id,title,content,created_by,updated_by) VALUES ($1,$2,$3,$4,$4) RETURNING *`,
    [projectId, data.title, data.content, userId],
  )).rows[0];
}

async function updateDoc(projectId, docId, data, userId, client = pool) {
  return (await client.query(
    `UPDATE project_docs SET title = CASE WHEN $3 THEN $4 ELSE title END,
       content = CASE WHEN $5 THEN $6 ELSE content END, updated_by = $7, updated_at = now()
     WHERE project_id = $1 AND id = $2 RETURNING *`,
    [projectId, docId, Object.hasOwn(data, 'title'), data.title ?? null, Object.hasOwn(data, 'content'), data.content ?? null, userId],
  )).rows[0] ?? null;
}

async function deleteDoc(projectId, docId, client = pool) {
  return (await client.query('DELETE FROM project_docs WHERE project_id = $1 AND id = $2 RETURNING id', [projectId, docId])).rowCount === 1;
}

async function listForms(projectId, client = pool) {
  return (await client.query(
    `SELECT f.*, count(s.id)::int AS submission_count FROM project_forms f
       LEFT JOIN form_submissions s ON s.form_id = f.id WHERE f.project_id = $1
      GROUP BY f.id ORDER BY f.updated_at DESC`, [projectId],
  )).rows;
}

async function findForm(projectId, formId, client = pool) {
  return (await client.query('SELECT * FROM project_forms WHERE project_id = $1 AND id = $2', [projectId, formId])).rows[0] ?? null;
}

async function createForm(projectId, data, userId, client = pool) {
  return (await client.query(
    `INSERT INTO project_forms (project_id,name,description,fields,is_active,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [projectId, data.name, data.description, JSON.stringify(data.fields), data.isActive, userId],
  )).rows[0];
}

async function updateForm(projectId, formId, data, client = pool) {
  return (await client.query(
    `UPDATE project_forms SET name = CASE WHEN $3 THEN $4 ELSE name END,
       description = CASE WHEN $5 THEN $6 ELSE description END,
       fields = CASE WHEN $7 THEN $8::jsonb ELSE fields END,
       is_active = CASE WHEN $9 THEN $10 ELSE is_active END, updated_at = now()
     WHERE project_id = $1 AND id = $2 RETURNING *`,
    [projectId, formId, Object.hasOwn(data, 'name'), data.name ?? null,
      Object.hasOwn(data, 'description'), data.description ?? null,
      Object.hasOwn(data, 'fields'), JSON.stringify(data.fields ?? []),
      Object.hasOwn(data, 'isActive'), data.isActive ?? null],
  )).rows[0] ?? null;
}

async function deleteForm(projectId, formId, client = pool) {
  return (await client.query('DELETE FROM project_forms WHERE project_id = $1 AND id = $2 RETURNING id', [projectId, formId])).rowCount === 1;
}

async function createSubmission(formId, answers, userId, client = pool) {
  return (await client.query(
    'INSERT INTO form_submissions (form_id,submitted_by,answers) VALUES ($1,$2,$3) RETURNING *',
    [formId, userId, JSON.stringify(answers)],
  )).rows[0];
}

async function listSubmissions(projectId, formId, client = pool) {
  return (await client.query(
    `SELECT s.*, u.name AS submitted_by_name FROM form_submissions s
       JOIN project_forms f ON f.id = s.form_id JOIN users u ON u.id = s.submitted_by
      WHERE f.project_id = $1 AND f.id = $2 ORDER BY s.created_at DESC`, [projectId, formId],
  )).rows;
}

module.exports = {
  createDevelopmentLink, createDoc, createForm, createSprint, createSubmission,
  deleteDevelopmentLink, deleteDoc, deleteForm, deleteSprint, findDoc, findForm, findSprint,
  getSummary, listDevelopmentLinks, listDocs, listForms, listSprints, listSubmissions,
  lockSprints, updateDoc, updateForm, updatePlanning, updateSprint,
};
