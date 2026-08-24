const assert = require('node:assert/strict');
const test = require('node:test');

const integrationEnabled = process.env.RUN_INTEGRATION === '1';

test('issues, history, comments, and polling satisfy the Phase 5 contract', { skip: !integrationEnabled }, async (context) => {
  const jwt = require('jsonwebtoken');

  const env = require('../../src/config/env');
  const pool = require('../../src/config/db');
  const { DEFAULT_POLL_INTERVAL_MS } = require('../../src/services/update.service');
  const startServer = require('../../src/server');

  assert.ok(DEFAULT_POLL_INTERVAL_MS >= 5000 && DEFAULT_POLL_INTERVAL_MS <= 10000);
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const users = {};
  for (const name of ['admin', 'member', 'viewer']) {
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [name, `${name}@issues.test`, 'not-used'],
    );
    users[name] = result.rows[0].id;
  }
  await pool.query("UPDATE users SET account_role = 'admin' WHERE id = $1", [users.admin]);
  const bootstrapId = (await pool.query("INSERT INTO projects (key,name,created_by) VALUES ('BOOT','Bootstrap Space',$1) RETURNING id", [users.admin])).rows[0].id;
  await pool.query("INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'admin')", [bootstrapId, users.admin]);

  const cookieFor = (name) => `token=${jwt.sign(
    { sub: String(users[name]) },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: '1h' },
  )}`;
  const server = startServer(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const request = (name, path, { method = 'GET', body } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      cookie: cookieFor(name),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  async function createProject(key) {
    const response = await request('admin', '/projects', {
      method: 'POST', body: { key, name: `${key} Project` },
    });
    assert.equal(response.status, 201);
    return (await response.json()).project.id;
  }

  const projectId = await createProject('TSK');
  const otherProjectId = await createProject('OTH');
  await pool.query("INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'member'),($1,$3,'viewer')", [projectId, users.member, users.viewer]);

  const types = (await (await request('member', `/projects/${projectId}/issue-types`)).json()).issueTypes;
  const taskType = types.find((type) => type.name === 'Task');
  const otherTypes = (await (await request('admin', `/projects/${otherProjectId}/issue-types`)).json()).issueTypes;
  const otherTaskType = otherTypes.find((type) => type.name === 'Task');
  const statuses = (await (await request('member', `/projects/${projectId}/workflow-statuses`)).json()).workflowStatuses;
  const defaultStatus = statuses.find((status) => status.is_default);
  const inProgress = statuses.find((status) => status.name === 'In Progress');
  const finalStatus = statuses.find((status) => status.is_final);
  const otherStatuses = (await (await request('admin', `/projects/${otherProjectId}/workflow-statuses`)).json()).workflowStatuses;

  const firstCreate = await request('member', `/projects/${projectId}/issues`, {
    method: 'POST',
    body: {
      title: 'First issue',
      issueTypeId: taskType.id,
      assigneeId: users.member,
      priority: 'high',
    },
  });
  assert.equal(firstCreate.status, 201);
  const firstIssue = (await firstCreate.json()).issue;
  assert.equal(firstIssue.issue_key, 'TSK-1');
  assert.equal(firstIssue.status_id, defaultStatus.id);
  let history = await pool.query('SELECT * FROM issue_status_history WHERE issue_id = $1 ORDER BY id', [firstIssue.id]);
  assert.equal(history.rowCount, 1);
  assert.equal(history.rows[0].from_status_id, null);

  assert.equal((await request('member', `/projects/${projectId}/issues`, {
    method: 'POST', body: { title: 'Wrong type', issueTypeId: otherTaskType.id },
  })).status, 400);

  const beforeRollback = await pool.query('SELECT last_number FROM project_issue_sequences WHERE project_id = $1', [projectId]);
  const rollbackResponse = await request('member', `/projects/${projectId}/issues`, {
    method: 'POST',
    body: { title: 'Rollback issue', issueTypeId: taskType.id, assigneeId: 999999 },
  });
  assert.equal(rollbackResponse.status, 403);
  const afterRollback = await pool.query('SELECT last_number FROM project_issue_sequences WHERE project_id = $1', [projectId]);
  assert.equal(afterRollback.rows[0].last_number, beforeRollback.rows[0].last_number);

  const concurrentResponses = await Promise.all(Array.from({ length: 12 }, (_, index) => request(
    'member',
    `/projects/${projectId}/issues`,
    { method: 'POST', body: { title: `Concurrent ${index + 1}`, issueTypeId: taskType.id } },
  )));
  assert.ok(concurrentResponses.every((response) => response.status === 201));
  const concurrentIssues = await Promise.all(concurrentResponses.map(async (response) => (await response.json()).issue));
  assert.equal(new Set(concurrentIssues.map((issue) => issue.issue_key)).size, 12);
  const sequence = await pool.query('SELECT last_number FROM project_issue_sequences WHERE project_id = $1', [projectId]);
  assert.equal(sequence.rows[0].last_number, 13);

  const pageResponse = await request('viewer', `/projects/${projectId}/issues?page=1&pageSize=5&status_id=${defaultStatus.id}&issue_type_id=${taskType.id}`);
  assert.equal(pageResponse.status, 200);
  const page = await pageResponse.json();
  assert.equal(page.issues.length, 5);
  assert.equal(page.total, 13);
  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 5);
  const assigneePage = await request('viewer', `/projects/${projectId}/issues?assignee_id=${users.member}`);
  const assigneeResult = await assigneePage.json();
  assert.equal(assigneeResult.total, 1);
  assert.equal(assigneeResult.issues[0].assignee_name, 'member');
  const createdOn = firstIssue.created_at.slice(0, 10);
  const createdPage = await request('viewer', `/projects/${projectId}/issues?created_on=${createdOn}`);
  assert.ok((await createdPage.json()).issues.some((issue) => issue.id === firstIssue.id));
  assert.equal((await request('viewer', `/projects/${projectId}/issues?created_on=not-a-date`)).status, 400);

  assert.equal((await request('viewer', `/issues/${firstIssue.issue_key}`)).status, 200);
  const updateResponse = await request('member', `/issues/${firstIssue.issue_key}`, {
    method: 'PATCH', body: { title: 'Updated first issue', priority: 'highest' },
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).issue.priority, 'highest');
  assert.equal((await request('member', `/issues/${firstIssue.issue_key}`, {
    method: 'PATCH', body: { assigneeId: users.viewer },
  })).status, 403);

  assert.equal((await request('member', `/issues/${firstIssue.issue_key}/status`, {
    method: 'PATCH', body: { statusId: otherStatuses[0].id },
  })).status, 400);
  const statusResponse = await request('member', `/issues/${firstIssue.issue_key}/status`, {
    method: 'PATCH', body: { statusId: inProgress.id },
  });
  assert.equal(statusResponse.status, 200);
  history = await pool.query('SELECT * FROM issue_status_history WHERE issue_id = $1 ORDER BY id', [firstIssue.id]);
  assert.equal(history.rowCount, 2);
  assert.equal(history.rows[1].from_status_id, defaultStatus.id);
  assert.equal(history.rows[1].to_status_id, inProgress.id);

  const completedResponse = await request('member', `/issues/${firstIssue.issue_key}/status`, {
    method: 'PATCH', body: { statusId: finalStatus.id },
  });
  assert.equal(completedResponse.status, 200);
  const completedIssue = (await completedResponse.json()).issue;
  assert.ok(completedIssue.completed_at);
  const completedOn = completedIssue.completed_at.slice(0, 10);
  const completedPage = await request('viewer', `/projects/${projectId}/issues?completed_on=${completedOn}`);
  assert.ok((await completedPage.json()).issues.some((issue) => issue.id === firstIssue.id));
  assert.equal((await request('member', `/issues/${firstIssue.issue_key}`, {
    method: 'PATCH', body: { title: 'Member cannot edit completed issue' },
  })).status, 403);
  assert.equal((await request('member', `/issues/${firstIssue.issue_key}/planning`, {
    method: 'PATCH', body: { dueDate: '2026-09-01' },
  })).status, 403);
  assert.equal((await request('member', `/issues/${firstIssue.issue_key}/status`, {
    method: 'PATCH', body: { statusId: inProgress.id },
  })).status, 403);
  const adminEdit = await request('admin', `/issues/${firstIssue.issue_key}`, {
    method: 'PATCH', body: { title: 'Admin edited completed issue', assigneeId: users.viewer },
  });
  assert.equal(adminEdit.status, 200);
  assert.equal((await adminEdit.json()).issue.assignee_id, users.viewer);
  const reopenedResponse = await request('admin', `/issues/${firstIssue.issue_key}/status`, {
    method: 'PATCH', body: { statusId: inProgress.id },
  });
  assert.equal(reopenedResponse.status, 200);
  assert.equal((await reopenedResponse.json()).issue.completed_at, null);
  assert.equal((await request('member', `/issues/${firstIssue.issue_key}`, {
    method: 'PATCH', body: { assigneeId: users.member },
  })).status, 200);

  assert.equal((await request('viewer', `/issues/${firstIssue.issue_key}/comments`, {
    method: 'POST', body: { content: 'Viewer cannot comment' },
  })).status, 403);
  const commentResponse = await request('member', `/issues/${firstIssue.issue_key}/comments`, {
    method: 'POST', body: { content: 'First comment' },
  });
  assert.equal(commentResponse.status, 201);
  const comment = (await commentResponse.json()).comment;
  const commentList = await request('viewer', `/issues/${firstIssue.issue_key}/comments`);
  assert.equal(commentList.status, 200);
  assert.equal((await commentList.json()).comments.length, 1);
  assert.equal((await request('admin', `/comments/${comment.id}`, {
    method: 'PATCH', body: { content: 'Admin cannot edit another author comment' },
  })).status, 403);
  const editedComment = await request('member', `/comments/${comment.id}`, {
    method: 'PATCH', body: { content: 'Edited comment' },
  });
  assert.equal(editedComment.status, 200);
  assert.ok((await editedComment.json()).comment.updated_at);

  const initialPoll = await request('viewer', `/projects/${projectId}/updates?since=${encodeURIComponent(new Date(0).toISOString())}`);
  assert.equal(initialPoll.status, 200);
  const initialUpdates = await initialPoll.json();
  assert.equal(initialUpdates.issues.length, 13);
  assert.ok(initialUpdates.comments.some((item) => item.id === comment.id));
  assert.ok(initialUpdates.serverTime);

  const newCommentResponse = await request('member', `/issues/${firstIssue.issue_key}/comments`, {
    method: 'POST', body: { content: 'After sync' },
  });
  const newComment = (await newCommentResponse.json()).comment;
  const nextPoll = await request('viewer', `/projects/${projectId}/updates?since=${encodeURIComponent(initialUpdates.serverTime)}`);
  assert.equal(nextPoll.status, 200);
  const nextUpdates = await nextPoll.json();
  assert.ok(nextUpdates.issues.some((issue) => issue.id === firstIssue.id));
  assert.ok(nextUpdates.comments.some((item) => item.id === newComment.id));
  assert.ok(new Date(nextUpdates.serverTime) >= new Date(initialUpdates.serverTime));

  assert.equal((await request('admin', `/comments/${newComment.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request('member', `/comments/${comment.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request('admin', `/issues/${firstIssue.issue_key}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request('viewer', `/issues/${firstIssue.issue_key}`)).status, 403);

  const invalidResponse = await request('viewer', `/projects/${projectId}/issues?pageSize=1000`);
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(Object.keys((await invalidResponse.json()).error).sort(), ['code', 'message']);
});
