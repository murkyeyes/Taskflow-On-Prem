const assert = require('node:assert/strict');
const test = require('node:test');

const integrationEnabled = process.env.RUN_INTEGRATION === '1';

test('report links enforce validation, Space RBAC, completed locking, and Admin override', { skip: !integrationEnabled }, async (context) => {
  const jwt = require('jsonwebtoken');
  const env = require('../../src/config/env');
  const pool = require('../../src/config/db');
  const startServer = require('../../src/server');

  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const users = {};
  for (const name of ['admin', 'member', 'viewer', 'outsider']) {
    users[name] = (await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [name, `${name}@attachments.test`, 'not-used'],
    )).rows[0].id;
  }
  await pool.query("UPDATE users SET account_role = 'admin' WHERE id = $1", [users.admin]);
  const bootstrapId = (await pool.query("INSERT INTO projects (key,name,created_by) VALUES ('BOOT','Bootstrap Space',$1) RETURNING id", [users.admin])).rows[0].id;
  await pool.query("INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'admin')", [bootstrapId, users.admin]);

  const cookieFor = (name) => `token=${jwt.sign({ sub: String(users[name]) }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })}`;
  const server = startServer(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const jsonRequest = (name, path, { method = 'GET', body } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie: cookieFor(name), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const projectResponse = await jsonRequest('admin', '/projects', { method: 'POST', body: { key: 'FILES', name: 'Reports Space' } });
  assert.equal(projectResponse.status, 201);
  const projectId = (await projectResponse.json()).project.id;
  await pool.query("INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'member'),($1,$3,'viewer')", [projectId, users.member, users.viewer]);
  const types = (await (await jsonRequest('member', `/projects/${projectId}/issue-types`)).json()).issueTypes;
  const statuses = (await (await jsonRequest('member', `/projects/${projectId}/workflow-statuses`)).json()).workflowStatuses;
  const createIssue = await jsonRequest('member', `/projects/${projectId}/issues`, { method: 'POST', body: { title: 'Daily report', issueTypeId: types[0].id } });
  assert.equal(createIssue.status, 201);
  const issue = (await createIssue.json()).issue;
  const memberLinkBody = { url: 'https://docs.google.com/spreadsheets/d/daily-report/edit', title: 'Daily report.xlsx' };
  assert.equal((await jsonRequest('viewer', `/issues/${issue.issue_key}/attachments`, { method: 'POST', body: memberLinkBody })).status, 403);
  assert.equal((await jsonRequest('member', `/issues/${issue.issue_key}/attachments`, { method: 'POST', body: { url: 'http://example.com/fake.xlsx' } })).status, 400);
  const createLink = await jsonRequest('member', `/issues/${issue.issue_key}/attachments`, { method: 'POST', body: memberLinkBody });
  assert.equal(createLink.status, 201);
  const memberAttachment = (await createLink.json()).attachment;
  assert.equal(memberAttachment.file_name, 'Daily report.xlsx');
  assert.equal(memberAttachment.file_size, null);
  assert.equal(memberAttachment.provider, 'Google Workspace');
  assert.match(memberAttachment.external_url, /^https:\/\/docs\.google\.com\//);

  const list = await jsonRequest('viewer', `/issues/${issue.issue_key}/attachments`);
  assert.equal(list.status, 200);
  assert.equal((await list.json()).attachments.length, 1);
  assert.equal((await jsonRequest('viewer', `/attachments/${memberAttachment.id}/download`)).status, 409);
  assert.equal((await jsonRequest('outsider', `/issues/${issue.issue_key}/attachments`)).status, 403);

  const adminCreate = await jsonRequest('admin', `/issues/${issue.issue_key}/attachments`, { method: 'POST', body: { url: 'https://tenant.sharepoint.com/reports/admin.xlsx?web=1' } });
  assert.equal(adminCreate.status, 201);
  const adminAttachment = (await adminCreate.json()).attachment;
  assert.equal((await jsonRequest('member', `/attachments/${adminAttachment.id}`, { method: 'DELETE' })).status, 403);

  const finalStatus = statuses.find((status) => status.is_final);
  assert.equal((await jsonRequest('member', `/issues/${issue.issue_key}/status`, { method: 'PATCH', body: { statusId: finalStatus.id } })).status, 200);
  assert.equal((await jsonRequest('member', `/issues/${issue.issue_key}/attachments`, { method: 'POST', body: memberLinkBody })).status, 403);
  assert.equal((await jsonRequest('member', `/attachments/${memberAttachment.id}`, { method: 'DELETE' })).status, 403);

  assert.equal((await jsonRequest('admin', `/issues/${issue.issue_key}/attachments`, { method: 'POST', body: { url: 'https://example.com/completed.xlsx' } })).status, 201);
  assert.equal((await jsonRequest('admin', `/attachments/${memberAttachment.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await jsonRequest('admin', `/attachments/${adminAttachment.id}`, { method: 'DELETE' })).status, 204);
});
