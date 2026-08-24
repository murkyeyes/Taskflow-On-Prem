const env = require('../config/env');
const authService = require('../services/auth.service');
const {
  requireEmail,
  requireEnum,
  requireInteger,
  requireObject,
  requireString,
} = require('../utils/validation');

const cookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.cookieSecure,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
});

async function register(request, response) {
  const body = requireObject(request.body);
  const user = await authService.register({
    name: requireString(body.name, 'name', { min: 1, max: 120 }),
    email: requireEmail(body.email),
    password: requireString(body.password, 'password', { min: 8, max: 72 }),
    accountRole: requireEnum(body.accountRole ?? 'member', 'accountRole', ['admin', 'member']),
    actorId: request.user.userId,
  });
  response.status(201).json({ user });
}

async function login(request, response) {
  const body = requireObject(request.body);
  const result = await authService.login({
    email: requireEmail(body.email),
    password: requireString(body.password, 'password', { min: 1, max: 72 }),
  });
  response.cookie('token', result.token, cookieOptions);
  response.json({ user: result.user });
}

function logout(request, response) {
  response.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
  });
  response.status(204).send();
}

async function me(request, response) {
  const user = await authService.getCurrentUser(request.user.userId);
  response.json({ user });
}

async function listUsers(request, response) {
  const rawSearch = request.query.search;
  const search = rawSearch === undefined || rawSearch === '' ? '' : requireString(rawSearch, 'search', { min: 1, max: 120 });
  response.json({ users: await authService.listUsers(search) });
}

async function changeRole(request, response) {
  const body = requireObject(request.body);
  response.json({ user: await authService.changeAccountRole(
    request.user.userId,
    requireInteger(request.params.userId, 'userId', { min: 1 }),
    requireEnum(body.accountRole, 'accountRole', ['admin', 'member']),
  ) });
}

async function deactivate(request, response) {
  response.json({ user: await authService.deactivateAccount(
    request.user.userId,
    requireInteger(request.params.userId, 'userId', { min: 1 }),
  ) });
}

module.exports = {
  changeRole,
  deactivate,
  login,
  logout,
  listUsers,
  me,
  register,
};
