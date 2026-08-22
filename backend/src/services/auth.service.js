const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const HttpError = require('../utils/httpError');

const passwordRounds = 12;
const tokenOptions = Object.freeze({ algorithm: 'HS256', expiresIn: '8h' });

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}

async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, passwordRounds);
  try {
    const user = await userRepository.create({ name, email, passwordHash });
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
  if (!user) {
    throw new HttpError(401, 'USER_NOT_FOUND', 'Authenticated user no longer exists');
  }
  return toPublicUser(user);
}

module.exports = {
  getCurrentUser,
  login,
  register,
  verifyToken,
};
