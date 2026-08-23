const assert = require('node:assert/strict');
const test = require('node:test');

const integrationEnabled = process.env.RUN_INTEGRATION === '1';

test('report attachments enforce validation, Space RBAC, completed locking, and Admin override', { skip: !integrationEnabled }, async (context) => {
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
  const fileRequest = (name, path, { method = 'POST', fileName = 'report.pdf', mediaType = 'application/pdf', body } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie: cookieFor(name), 'content-type': mediaType, 'x-file-name': encodeURIComponent(fileName) },
    body,
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
  const pdf = Buffer.from('%PDF-1.4\nTaskflow report\n%%EOF');

  assert.equal((await fileRequest('viewer', `/issues/${issue.issue_key}/attachments`, { body: pdf })).status, 403);
  assert.equal((await fileRequest('member', `/issues/${issue.issue_key}/attachments`, { fileName: 'fake.pdf', body: Buffer.from('fake') })).status, 415);
  const upload = await fileRequest('member', `/issues/${issue.issue_key}/attachments`, { fileName: 'daily report.pdf', body: pdf });
  assert.equal(upload.status, 201);
  const memberAttachment = (await upload.json()).attachment;
  assert.equal(memberAttachment.file_name, 'daily report.pdf');
  assert.equal(memberAttachment.file_size, pdf.length);

  const list = await jsonRequest('viewer', `/issues/${issue.issue_key}/attachments`);
  assert.equal(list.status, 200);
  assert.equal((await list.json()).attachments.length, 1);
  const download = await jsonRequest('viewer', `/attachments/${memberAttachment.id}/download`);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
  assert.equal((await jsonRequest('outsider', `/attachments/${memberAttachment.id}/download`)).status, 403);

  const adminUpload = await fileRequest('admin', `/issues/${issue.issue_key}/attachments`, { fileName: 'admin.pdf', body: pdf });
  assert.equal(adminUpload.status, 201);
  const adminAttachment = (await adminUpload.json()).attachment;
  assert.equal((await jsonRequest('member', `/attachments/${adminAttachment.id}`, { method: 'DELETE' })).status, 403);

  const finalStatus = statuses.find((status) => status.is_final);
  assert.equal((await jsonRequest('member', `/issues/${issue.issue_key}/status`, { method: 'PATCH', body: { statusId: finalStatus.id } })).status, 200);
  assert.equal((await fileRequest('member', `/issues/${issue.issue_key}/attachments`, { body: pdf })).status, 403);
  assert.equal((await jsonRequest('member', `/attachments/${memberAttachment.id}`, { method: 'DELETE' })).status, 403);

  assert.equal((await fileRequest('admin', `/issues/${issue.issue_key}/attachments`, { fileName: 'completed.xlsx', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]) })).status, 201);
  assert.equal((await jsonRequest('admin', `/attachments/${memberAttachment.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await jsonRequest('admin', `/attachments/${adminAttachment.id}`, { method: 'DELETE' })).status, 204);
});
