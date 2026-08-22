const authService = require('../services/auth.service');
const HttpError = require('../utils/httpError');

function requireAuth(request, response, next) {
  const token = request.cookies?.token;
  if (!token) {
    return next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
  }

  try {
    request.user = authService.verifyToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireAuth,
};
