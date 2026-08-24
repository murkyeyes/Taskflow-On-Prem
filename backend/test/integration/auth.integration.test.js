const assert = require('node:assert/strict');
const test = require('node:test');

const integrationEnabled = process.env.RUN_INTEGRATION === '1';

test('authentication API uses bcrypt, JWT, and an HttpOnly token cookie', { skip: !integrationEnabled }, async (context) => {
  const pool = require('../../src/config/db');
  const authService = require('../../src/services/auth.service');
  const jwt = require('jsonwebtoken');
  const env = require('../../src/config/env');
  const startServer = require('../../src/server');

  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const server = startServer(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
  const jsonRequest = (path, body, headers = {}) => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  const unauthenticatedMe = await fetch(`${baseUrl}/me`);
  assert.equal(unauthenticatedMe.status, 401);

  const publicRegister = await jsonRequest('/register', {
    name: 'Public user', email: 'public@example.com', password: 'correct-horse-battery-staple',
  });
  assert.equal(publicRegister.status, 401);
  const adminId = (await pool.query("INSERT INTO users (name,email,password_hash,account_role) VALUES ('Admin','admin@auth.test','unused','admin') RETURNING id")).rows[0].id;
  const projectId = (await pool.query("INSERT INTO projects (key,name,created_by) VALUES ('AUTH','Auth', $1) RETURNING id", [adminId])).rows[0].id;
  await pool.query("INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'admin')", [projectId, adminId]);
  const adminCookie = `token=${jwt.sign({ sub: String(adminId) }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })}`;
  const registerResponse = await jsonRequest('/register', {
    name: 'Auth Test User',
    email: 'auth@example.com',
    password: 'correct-horse-battery-staple',
  }, { cookie: adminCookie });
  assert.equal(registerResponse.status, 201);
  const registered = await registerResponse.json();
  assert.equal(registered.user.email, 'auth@example.com');
  assert.equal('passwordHash' in registered.user, false);

  const storedUser = await pool.query(
    'SELECT id, password_hash FROM users WHERE email = $1',
    ['auth@example.com'],
  );
  assert.match(storedUser.rows[0].password_hash, /^\$2[aby]\$12\$/);
  assert.notEqual(storedUser.rows[0].password_hash, 'correct-horse-battery-staple');

  const duplicateResponse = await jsonRequest('/register', {
    name: 'Duplicate',
    email: 'auth@example.com',
    password: 'another-valid-password',
  }, { cookie: adminCookie });
  assert.equal(duplicateResponse.status, 409);

  const invalidLogin = await jsonRequest('/login', {
    email: 'auth@example.com',
    password: 'incorrect-password',
  });
  assert.equal(invalidLogin.status, 401);

  const loginResponse = await jsonRequest('/login', {
    email: 'auth@example.com',
    password: 'correct-horse-battery-staple',
  });
  assert.equal(loginResponse.status, 200);
  const loginBody = await loginResponse.json();
  assert.equal(loginBody.user.id, storedUser.rows[0].id);

  const setCookie = loginResponse.headers.get('set-cookie');
  assert.match(setCookie, /^token=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];
  const token = cookie.slice('token='.length);
  assert.deepEqual(authService.verifyToken(token), { userId: storedUser.rows[0].id });

  const meResponse = await fetch(`${baseUrl}/me`, { headers: { cookie } });
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).user.email, 'auth@example.com');

  const logoutResponse = await fetch(`${baseUrl}/logout`, {
    method: 'POST',
    headers: { cookie },
  });
  assert.equal(logoutResponse.status, 204);
  assert.match(logoutResponse.headers.get('set-cookie'), /^token=;/);
});
