const assert = require('node:assert/strict');
const test = require('node:test');

test('Overall Admin exclusively manages account Admin privileges', { skip: process.env.RUN_ACCOUNT_ROLE_INTEGRATION !== '1' }, async (context) => {
  const bcrypt = require('bcryptjs'); const jwt = require('jsonwebtoken');
  const env = require('../../src/config/env'); const pool = require('../../src/config/db'); const startServer = require('../../src/server');
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const passwordHash = await bcrypt.hash('OriginalPass123', 4); const users = {};
  for (const [name, role] of [['owner','overall_admin'],['admin','admin'],['member','member'],['target','member']]) {
    users[name] = (await pool.query('INSERT INTO users(name,email,password_hash,account_role) VALUES($1,$2,$3,$4) RETURNING id', [name, `${name}@roles.test`, passwordHash, role])).rows[0].id;
  }
  const projectId = (await pool.query("INSERT INTO projects(key,name,created_by) VALUES('ROLE','Roles',$1) RETURNING id", [users.owner])).rows[0].id;
  await pool.query("INSERT INTO project_members(project_id,user_id,project_role) VALUES($1,$2,'admin')", [projectId, users.target]);
  const typeId = (await pool.query("INSERT INTO issue_types(project_id,name) VALUES($1,'Task') RETURNING id", [projectId])).rows[0].id;
  const statusId = (await pool.query("INSERT INTO workflow_statuses(project_id,name,position,is_default) VALUES($1,'To Do',0,true) RETURNING id", [projectId])).rows[0].id;
  const issueId = (await pool.query("INSERT INTO issues(project_id,issue_key,title,issue_type_id,status_id,reporter_id,assignee_id) VALUES($1,'ROLE-1','Retained history',$2,$3,$4,$4) RETURNING id", [projectId, typeId, statusId, users.target])).rows[0].id;
  const token = (name) => jwt.sign({ sub: String(users[name]) }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' });
  const server = startServer(0); await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await pool.end(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (name, path, { method = 'GET', body } = {}) => fetch(`${base}${path}`, { method, headers: { cookie: `token=${token(name)}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

  assert.equal((await request('admin', '/auth/register', { method: 'POST', body: { name: 'Denied Admin', email: 'denied@roles.test', password: 'Password123', accountRole: 'admin' } })).status, 403);
  assert.equal((await request('admin', '/auth/register', { method: 'POST', body: { name: 'Allowed Member', email: 'allowed@roles.test', password: 'Password123', accountRole: 'member' } })).status, 201);
  const createdAdmin = await request('owner', '/auth/register', { method: 'POST', body: { name: 'Created Admin', email: 'created-admin@roles.test', password: 'Password123', accountRole: 'admin' } });
  assert.equal(createdAdmin.status, 201); assert.equal((await createdAdmin.json()).user.accountRole, 'admin');
  assert.equal((await request('admin', `/auth/users/${users.target}/role`, { method: 'PATCH', body: { accountRole: 'admin' } })).status, 403);
  assert.equal((await request('owner', `/auth/users/${users.owner}/role`, { method: 'PATCH', body: { accountRole: 'member' } })).status, 409);
  const promoted = await request('owner', `/auth/users/${users.target}/role`, { method: 'PATCH', body: { accountRole: 'admin' } });
  assert.equal(promoted.status, 200); assert.equal((await promoted.json()).user.accountRole, 'admin');
  const demoted = await request('owner', `/auth/users/${users.target}/role`, { method: 'PATCH', body: { accountRole: 'member' } });
  assert.equal(demoted.status, 200); assert.equal((await demoted.json()).user.accountRole, 'member');
  const membership = await pool.query('SELECT project_role FROM project_members WHERE project_id=$1 AND user_id=$2', [projectId, users.target]);
  assert.equal(membership.rows[0].project_role, 'member');

  assert.equal((await request('owner', `/auth/users/${users.owner}`, { method: 'DELETE' })).status, 409);
  const deactivated = await request('admin', `/auth/users/${users.target}`, { method: 'DELETE' });
  assert.equal(deactivated.status, 200);
  assert.ok((await deactivated.json()).user.deactivatedAt);
  assert.equal((await request('target', '/auth/me')).status, 401);
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'target@roles.test', password: 'OriginalPass123' }) });
  assert.equal(login.status, 401);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM project_members WHERE user_id=$1', [users.target])).rows[0].count, 0);
  const retained = await pool.query('SELECT issue.id, reporter.name AS reporter_name, assignee.name AS assignee_name FROM issues issue JOIN users reporter ON reporter.id=issue.reporter_id JOIN users assignee ON assignee.id=issue.assignee_id WHERE issue.id=$1', [issueId]);
  assert.deepEqual(retained.rows[0], { id: issueId, reporter_name: 'target', assignee_name: 'target' });
  const directory = await request('owner', '/auth/users');
  assert.equal((await directory.json()).users.some((account) => account.id === users.target), false);
});
