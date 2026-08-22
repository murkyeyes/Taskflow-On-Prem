const assert = require('node:assert/strict');
const test = require('node:test');

const integrationEnabled = process.env.RUN_INTEGRATION === '1';

test('project domain APIs enforce transactions, invariants, and RBAC', { skip: !integrationEnabled }, async (context) => {
  const jwt = require('jsonwebtoken');

  const env = require('../../src/config/env');
  const pool = require('../../src/config/db');
  const projectService = require('../../src/services/project.service');
  const startServer = require('../../src/server');

  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const users = {};
  for (const name of ['admin', 'member', 'viewer', 'removable', 'outsider']) {
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [name, `${name}@project.test`, 'not-used'],
    );
    users[name] = result.rows[0].id;
  }

  const tokenFor = (name) => jwt.sign(
    { sub: String(users[name]) },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  const cookieFor = (name) => `token=${tokenFor(name)}`;

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

  const createResponse = await request('admin', '/projects', {
    method: 'POST',
    body: { key: 'demo', name: 'Demo Project', description: 'Project domain test' },
  });
  assert.equal(createResponse.status, 201);
  const projectId = (await createResponse.json()).project.id;

  const invariants = await pool.query(
    `SELECT
       (SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2) AS creator_role,
       (SELECT last_number FROM project_issue_sequences WHERE project_id = $1) AS last_number,
       (SELECT count(*)::int FROM issue_types WHERE project_id = $1) AS type_count,
       (SELECT count(*)::int FROM workflow_statuses WHERE project_id = $1) AS status_count,
       (SELECT count(*)::int FROM workflow_statuses WHERE project_id = $1 AND is_default) AS default_count,
       (SELECT count(*)::int FROM workflow_statuses WHERE project_id = $1 AND is_final) AS final_count`,
    [projectId, users.admin],
  );
  assert.deepEqual(invariants.rows[0], {
    creator_role: 'admin',
    last_number: 0,
    type_count: 3,
    status_count: 3,
    default_count: 1,
    final_count: 1,
  });

  assert.equal((await request('admin', '/projects')).status, 200);
  assert.equal((await request('admin', `/projects/${projectId}`)).status, 200);
  assert.equal((await request('admin', `/projects/${projectId}`, {
    method: 'PATCH', body: { name: 'Renamed Project' },
  })).status, 200);

  for (const [name, projectRole] of [['member', 'member'], ['viewer', 'viewer'], ['removable', 'viewer']]) {
    const response = await request('admin', `/projects/${projectId}/members`, {
      method: 'POST', body: { userId: users[name], projectRole },
    });
    assert.equal(response.status, 201);
  }
  assert.equal((await request('member', `/projects/${projectId}/members`)).status, 200);
  assert.equal((await request('viewer', `/projects/${projectId}/members`)).status, 403);
  assert.equal((await request('member', `/projects/${projectId}/members`, {
    method: 'POST', body: { userId: users.outsider, projectRole: 'viewer' },
  })).status, 403);
  assert.equal((await request('admin', `/projects/${projectId}/members/${users.removable}`, {
    method: 'PATCH', body: { projectRole: 'member' },
  })).status, 200);
  assert.equal((await request('admin', `/projects/${projectId}/members/${users.removable}`, {
    method: 'DELETE',
  })).status, 204);

  assert.equal((await request('member', `/projects/${projectId}`, {
    method: 'PATCH', body: { name: 'Forbidden rename' },
  })).status, 403);
  assert.equal((await request('viewer', `/projects/${projectId}`)).status, 200);

  const typeList = await request('member', `/projects/${projectId}/issue-types`);
  assert.equal(typeList.status, 200);
  assert.equal((await request('viewer', `/projects/${projectId}/issue-types`)).status, 200);
  const defaultTypes = (await typeList.json()).issueTypes;
  const taskType = defaultTypes.find((type) => type.name === 'Task');
  const epicResponse = await request('admin', `/projects/${projectId}/issue-types`, {
    method: 'POST', body: { name: 'Epic', color: '#6554C0' },
  });
  assert.equal(epicResponse.status, 201);
  const epicId = (await epicResponse.json()).issueType.id;
  assert.equal((await request('admin', `/projects/${projectId}/issue-types/${epicId}`, {
    method: 'PATCH', body: { name: 'Initiative' },
  })).status, 200);
  assert.equal((await request('admin', `/projects/${projectId}/issue-types/${epicId}`, {
    method: 'DELETE',
  })).status, 204);

  const statusList = await request('member', `/projects/${projectId}/workflow-statuses`);
  assert.equal(statusList.status, 200);
  assert.equal((await request('viewer', `/projects/${projectId}/workflow-statuses`)).status, 200);
  let statuses = (await statusList.json()).workflowStatuses;
  const defaultStatus = statuses.find((status) => status.is_default);
  const reviewResponse = await request('admin', `/projects/${projectId}/workflow-statuses`, {
    method: 'POST', body: { name: 'Review', position: 3, isDefault: false, isFinal: false },
  });
  assert.equal(reviewResponse.status, 201);
  const reviewId = (await reviewResponse.json()).workflowStatus.id;
  assert.equal((await request('admin', `/projects/${projectId}/workflow-statuses/${reviewId}`, {
    method: 'PATCH', body: { name: 'Code Review' },
  })).status, 200);

  statuses = (await (await request('member', `/projects/${projectId}/workflow-statuses`)).json()).workflowStatuses;
  const reversedIds = statuses.map((status) => status.id).reverse();
  const reorderResponse = await request('admin', `/projects/${projectId}/workflow-statuses/reorder`, {
    method: 'PATCH', body: { orderedIds: reversedIds },
  });
  assert.equal(reorderResponse.status, 200);
  const reordered = (await reorderResponse.json()).workflowStatuses;
  assert.deepEqual(reordered.map((status) => status.position), [0, 1, 2, 3]);
  assert.deepEqual(reordered.map((status) => status.id), reversedIds);

  await pool.query(
    `INSERT INTO issues (project_id, issue_key, title, issue_type_id, status_id, reporter_id)
     VALUES ($1, 'DEMO-1', 'Protected references', $2, $3, $4)`,
    [projectId, taskType.id, defaultStatus.id, users.admin],
  );
  assert.equal((await request('admin', `/projects/${projectId}/issue-types/${taskType.id}`, {
    method: 'DELETE',
  })).status, 409);
  assert.equal((await request('admin', `/projects/${projectId}/workflow-statuses/${defaultStatus.id}`, {
    method: 'DELETE',
  })).status, 409);
  assert.equal((await request('admin', `/projects/${projectId}/workflow-statuses/${reviewId}`, {
    method: 'DELETE',
  })).status, 204);

  await assert.rejects(
    projectService.createProject(
      { key: 'RBK', name: 'Rollback Project', description: null },
      users.admin,
      { issueTypes: [{ name: 'Duplicate' }, { name: 'Duplicate' }] },
    ),
    { status: 409, code: 'PROJECT_CONFLICT' },
  );
  const rollbackProject = await pool.query("SELECT count(*)::int AS count FROM projects WHERE key = 'RBK'");
  assert.equal(rollbackProject.rows[0].count, 0);

  assert.equal((await request('admin', `/projects/${projectId}`, { method: 'DELETE' })).status, 204);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM projects WHERE id = $1', [projectId])).rows[0].count, 0);
});
