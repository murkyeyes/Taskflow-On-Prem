const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const HttpError = require('../utils/httpError');
const withTransaction = require('../utils/withTransaction');

const passwordRounds = 12;
const tokenOptions = Object.freeze({ algorithm: 'HS256', expiresIn: '8h' });

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accountRole: user.account_role,
    createdAt: user.created_at,
    deactivatedAt: user.deactivated_at,
  };
}

async function register({ name, email, password, accountRole = 'member', actorId }) {
  const actor = await userRepository.findById(actorId);
  if (!actor || !['overall_admin', 'admin'].includes(actor.account_role)) throw new HttpError(403, 'FORBIDDEN', 'Only application administrators can create accounts');
  if (accountRole === 'admin' && actor.account_role !== 'overall_admin') throw new HttpError(403, 'OVERALL_ADMIN_REQUIRED', 'Only the Overall Admin can create another Admin');
  const passwordHash = await bcrypt.hash(password, passwordRounds);
  try {
    const user = await userRepository.create({ name, email, passwordHash, accountRole });
    return toPublicUser(user);
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }
    throw error;
  }
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!validPassword) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return {
    user: toPublicUser(user),
    token: jwt.sign({ sub: String(user.id) }, env.jwtSecret, tokenOptions),
  };
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new Error('Invalid subject');
    }
    return { userId };
  } catch {
    throw new HttpError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired');
  }
}

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user || user.deactivated_at) {
    throw new HttpError(401, 'USER_NOT_FOUND', 'Authenticated user no longer exists');
  }
  return toPublicUser(user);
}

async function assertActiveAccount(userId) {
  const user = await userRepository.findById(userId);
  if (!user || user.deactivated_at) throw new HttpError(401, 'ACCOUNT_DEACTIVATED', 'This account is no longer active');
  return user;
}

async function listUsers(search) {
  return (await userRepository.search(search)).map(toPublicUser);
}

async function changeAccountRole(actorId, targetId, accountRole) {
  return withTransaction(async (client) => {
    const actor = await userRepository.findForUpdate(actorId, client);
    if (!actor || actor.account_role !== 'overall_admin') throw new HttpError(403, 'OVERALL_ADMIN_REQUIRED', 'Only the Overall Admin can change Admin privileges');
    if (actorId === targetId) throw new HttpError(409, 'OVERALL_ADMIN_PROTECTED', 'The Overall Admin cannot change its own role');
    const target = await userRepository.findForUpdate(targetId, client);
    if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'Account not found');
    if (target.account_role === 'overall_admin') throw new HttpError(409, 'OVERALL_ADMIN_PROTECTED', 'The Overall Admin role cannot be revoked');
    const updated = await userRepository.updateAccountRole(targetId, accountRole, client);
    if (accountRole === 'member') await userRepository.downgradeAdminMemberships(targetId, client);
    return toPublicUser(updated);
  });
}

async function deactivateAccount(actorId, targetId) {
  return withTransaction(async (client) => {
    const actor = await userRepository.findForUpdate(actorId, client);
    if (!actor || actor.deactivated_at || !['overall_admin', 'admin'].includes(actor.account_role)) {
      throw new HttpError(403, 'FORBIDDEN', 'Only application administrators can deactivate accounts');
    }
    if (actorId === targetId) throw new HttpError(409, 'SELF_DEACTIVATION_FORBIDDEN', 'You cannot deactivate your own account');
    const target = await userRepository.findForUpdate(targetId, client);
    if (!target || target.deactivated_at) throw new HttpError(404, 'USER_NOT_FOUND', 'Active account not found');
    if (target.account_role === 'overall_admin') throw new HttpError(409, 'OVERALL_ADMIN_PROTECTED', 'The Overall Admin account cannot be deactivated');
    if (target.account_role === 'admin' && actor.account_role !== 'overall_admin') {
      throw new HttpError(403, 'OVERALL_ADMIN_REQUIRED', 'Only the Overall Admin can deactivate another Admin');
    }
    const deactivated = await userRepository.deactivate(targetId, actorId, client);
    await userRepository.removeMemberships(targetId, client);
    return toPublicUser(deactivated);
  });
}

module.exports = {
  changeAccountRole,
  assertActiveAccount,
  deactivateAccount,
  getCurrentUser,
  login,
  listUsers,
  register,
  verifyToken,
};
