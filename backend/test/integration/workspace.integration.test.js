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
  const cookie = (role) => `token=${jwt.sign({ sub: String(users[role]) }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })}`;
  const server = startServer(0); await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await pool.end(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (role, path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { cookie: cookie(role), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

  const project = (await (await request('admin', '/projects', 'POST', { key: 'WORK', name: 'Workspace' })).json()).project;
  for (const role of ['member', 'viewer']) assert.equal((await request('admin', `/projects/${project.id}/members`, 'POST', { userId: users[role], projectRole: role })).status, 201);
  const type = (await (await request('admin', `/projects/${project.id}/issue-types`)).json()).issueTypes[0];
  const issue = (await (await request('member', `/projects/${project.id}/issues`, 'POST', { title: 'Plan this work', issueTypeId: type.id })).json()).issue;

  assert.equal((await request('viewer', `/projects/${project.id}/summary`)).status, 200);
  assert.equal((await request('viewer', `/projects/${project.id}/sprints`, 'POST', { name: 'Forbidden' })).status, 403);
  const sprintResponse = await request('member', `/projects/${project.id}/sprints`, 'POST', { name: 'Sprint 1', status: 'active', startDate: '2026-08-22', endDate: '2026-08-29' });
  assert.equal(sprintResponse.status, 201); const sprint = (await sprintResponse.json()).sprint;
  assert.equal((await request('admin', `/projects/${project.id}/sprints`, 'POST', { name: 'Sprint 2', status: 'active' })).status, 409);
  assert.equal((await request('member', `/issues/${issue.issue_key}/planning`, 'PATCH', { sprintId: sprint.id, dueDate: '2026-08-28', storyPoints: 5 })).status, 200);

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
  assert.equal(persisted.rows[0].sprint_id, sprint.id); assert.equal(persisted.rows[0].story_points, 5);
});
