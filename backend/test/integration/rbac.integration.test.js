const assert = require('node:assert/strict');
const test = require('node:test');

const integrationEnabled = process.env.RUN_INTEGRATION === '1';

test('RBAC resolves project roles from projectId and issueKey', { skip: !integrationEnabled }, async (context) => {
  const cookieParser = require('cookie-parser');
  const express = require('express');
  const jwt = require('jsonwebtoken');

  const env = require('../../src/config/env');
  const pool = require('../../src/config/db');
  const { requireAuth } = require('../../src/middlewares/auth.middleware');
  const { errorHandler } = require('../../src/middlewares/errorHandler.middleware');
  const { requireRole } = require('../../src/middlewares/rbac.middleware');

  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const users = {};
  for (const role of ['admin', 'member', 'viewer', 'outsider']) {
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [role, `${role}@example.com`, 'not-used-by-this-test'],
    );
    users[role] = result.rows[0].id;
  }
  await pool.query("UPDATE users SET account_role = 'admin' WHERE id = $1", [users.admin]);

  const project = await pool.query(
    "INSERT INTO projects (key, name, created_by) VALUES ('RBAC', 'RBAC Project', $1) RETURNING id",
    [users.admin],
  );
  const projectId = project.rows[0].id;
  for (const role of ['admin', 'member', 'viewer']) {
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, project_role) VALUES ($1, $2, $3)',
      [projectId, users[role], role],
    );
  }
  await pool.query('INSERT INTO project_issue_sequences (project_id) VALUES ($1)', [projectId]);
  const issueType = await pool.query(
    "INSERT INTO issue_types (project_id, name) VALUES ($1, 'Task') RETURNING id",
    [projectId],
  );
  const status = await pool.query(
    "INSERT INTO workflow_statuses (project_id, name, position, is_default) VALUES ($1, 'To Do', 0, true) RETURNING id",
    [projectId],
  );
  await pool.query(
    `INSERT INTO issues (project_id, issue_key, title, issue_type_id, status_id, reporter_id)
     VALUES ($1, 'RBAC-1', 'RBAC issue', $2, $3, $4)`,
    [projectId, issueType.rows[0].id, status.rows[0].id, users.admin],
  );

  const app = express();
  app.use(cookieParser());
  const respond = (request, response) => response.json({
    projectId: request.projectId,
    projectRole: request.projectRole,
  });
  app.get('/project/:projectId/admin', requireAuth, requireRole(['admin']), respond);
  app.get('/project/:projectId/member', requireAuth, requireRole(['admin', 'member']), respond);
  app.get('/project/:projectId/viewer', requireAuth, requireRole(['admin', 'member', 'viewer']), respond);
  app.get('/issue/:issueKey/member', requireAuth, requireRole(['admin', 'member']), respond);
  app.use(errorHandler);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookieFor = (role) => {
    const token = jwt.sign({ sub: String(users[role]) }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' });
    return `token=${token}`;
  };
  const requestAs = (role, path) => fetch(`${baseUrl}${path}`, {
    headers: role ? { cookie: cookieFor(role) } : {},
  });

  assert.equal((await requestAs(null, `/project/${projectId}/viewer`)).status, 401);
  assert.equal((await requestAs('admin', `/project/${projectId}/admin`)).status, 200);
  assert.equal((await requestAs('member', `/project/${projectId}/admin`)).status, 403);
  assert.equal((await requestAs('viewer', `/project/${projectId}/admin`)).status, 403);
  assert.equal((await requestAs('admin', `/project/${projectId}/member`)).status, 200);
  assert.equal((await requestAs('member', `/project/${projectId}/member`)).status, 200);
  assert.equal((await requestAs('viewer', `/project/${projectId}/member`)).status, 403);

  for (const role of ['admin', 'member', 'viewer']) {
    const response = await requestAs(role, `/project/${projectId}/viewer`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { projectId, projectRole: role });
  }

  assert.equal((await requestAs('admin', '/issue/RBAC-1/member')).status, 200);
  assert.equal((await requestAs('member', '/issue/RBAC-1/member')).status, 200);
  assert.equal((await requestAs('viewer', '/issue/RBAC-1/member')).status, 403);
  assert.equal((await requestAs('outsider', `/project/${projectId}/viewer`)).status, 403);
});
