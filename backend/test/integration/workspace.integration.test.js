const assert = require('node:assert/strict');
const test = require('node:test');

const integrationEnabled = process.env.RUN_INTEGRATION === '1';

test('Jira workspace APIs persist data and enforce ownership and RBAC', { skip: !integrationEnabled }, async (context) => {
  const jwt = require('jsonwebtoken');
  const env = require('../../src/config/env');
  const pool = require('../../src/config/db');
  const startServer = require('../../src/server');

  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const users = {};
  for (const role of ['admin', 'member', 'viewer']) {
    users[role] = (await pool.query(
      'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id',
      [role, `${role}@workspace.test`, 'unused'],
    )).rows[0].id;
  }
  const bootstrapId = (await pool.query("INSERT INTO projects (key,name,created_by) VALUES ('BOOT','Bootstrap Space',$1) RETURNING id", [users.admin])).rows[0].id;
  await pool.query("INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'admin')", [bootstrapId, users.admin]);
  const cookie = (role) => `token=${jwt.sign({ sub: String(users[role]) }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })}`;
  const server = startServer(0); await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await pool.end(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (role, path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { cookie: cookie(role), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

  const project = (await (await request('admin', '/projects', 'POST', { key: 'WORK', name: 'Workspace' })).json()).project;
  await pool.query("INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'member'),($1,$3,'viewer')", [project.id, users.member, users.viewer]);
  const type = (await (await request('admin', `/projects/${project.id}/issue-types`)).json()).issueTypes[0];
  const issue = (await (await request('member', `/projects/${project.id}/issues`, 'POST', { title: 'Plan this work', issueTypeId: type.id })).json()).issue;

  const assigneeLookup = await request('member', `/projects/${project.id}/assignees?search=view`);
  assert.equal(assigneeLookup.status, 200); assert.equal((await assigneeLookup.json()).assignees[0].user_id, users.viewer);
  const allAssignees = await request('member', `/projects/${project.id}/assignees`);
  assert.equal(allAssignees.status, 200); assert.equal((await allAssignees.json()).assignees.length, 3);
  assert.equal((await request('member', `/projects/${project.id}/issues`, 'POST', { title: 'Wrong assignee', issueTypeId: type.id, assigneeId: 999999 })).status, 400);

  assert.equal((await request('viewer', `/projects/${project.id}/summary`)).status, 200);
  assert.equal((await request('viewer', `/projects/${project.id}/sprints`, 'POST', { name: 'Forbidden' })).status, 403);
  const sprintResponse = await request('member', `/projects/${project.id}/sprints`, 'POST', { name: 'Sprint 1', status: 'active', startDate: '2026-08-22', endDate: '2026-08-29' });
  assert.equal(sprintResponse.status, 201); const sprint = (await sprintResponse.json()).sprint;
  assert.equal((await request('admin', `/projects/${project.id}/sprints`, 'POST', { name: 'Sprint 2', status: 'active' })).status, 409);
  assert.equal((await request('member', `/issues/${issue.issue_key}/planning`, 'PATCH', { sprintId: sprint.id, dueDate: '2026-08-28', storyPoints: 5 })).status, 200);
  const secondIssue = (await (await request('member', `/projects/${project.id}/issues`, 'POST', { title: 'Searchable board work', issueTypeId: type.id, assigneeId: users.member, statusId: (await (await request('admin', `/projects/${project.id}/workflow-statuses`)).json()).workflowStatuses[0].id, dueDate: '2026-08-29' })).json()).issue;
  assert.equal((await (await request('viewer', `/projects/${project.id}/issues?search=Searchable`)).json()).issues[0].id, secondIssue.id);
  const completed = await request('member', `/projects/${project.id}/sprints/${sprint.id}/complete`, 'POST');
  assert.equal(completed.status, 200); assert.equal((await completed.json()).movedIssueCount, 1);
  assert.equal((await request('member', `/projects/${project.id}/sprints/${sprint.id}/complete`, 'POST')).status, 409);

  const doc = (await (await request('member', `/projects/${project.id}/docs`, 'POST', { title: 'Plan', content: 'Ship it' })).json()).doc;
  assert.equal((await request('viewer', `/projects/${project.id}/docs`)).status, 200);
  assert.equal((await request('member', `/projects/${project.id}/docs/${doc.id}`, 'DELETE')).status, 403);

  const form = (await (await request('admin', `/projects/${project.id}/forms`, 'POST', { name: 'Request', description: '', fields: [{ id: 'summary', label: 'Summary', type: 'text' }], isActive: true })).json()).form;
  assert.equal((await request('viewer', `/projects/${project.id}/forms/${form.id}/submissions`, 'POST', { answers: { summary: 'Help' } })).status, 201);
  const submissions = await request('member', `/projects/${project.id}/forms/${form.id}/submissions`);
  assert.equal(submissions.status, 200); assert.equal((await submissions.json()).submissions.length, 1);

  const linkResponse = await request('member', `/projects/${project.id}/development-links`, 'POST', { issueKey: issue.issue_key, provider: 'GitHub', linkType: 'pull_request', title: 'PR 1', url: 'https://example.com/pr/1', status: 'open' });
  assert.equal(linkResponse.status, 201);
  assert.equal((await request('viewer', `/projects/${project.id}/development-links`)).status, 200);
  const persisted = await pool.query('SELECT sprint_id,due_date,story_points FROM issues WHERE id=$1', [issue.id]);
  assert.equal(persisted.rows[0].sprint_id, null); assert.equal(persisted.rows[0].story_points, 5);
});
