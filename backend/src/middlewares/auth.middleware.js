const authService = require('../services/auth.service');
const HttpError = require('../utils/httpError');

async function requireAuth(request, response, next) {
  const token = request.cookies?.token;
  if (!token) {
    return next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
  }

  try {
    const verified = authService.verifyToken(token);
    await authService.assertActiveAccount(verified.userId);
    request.user = verified;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireAuth,
};
