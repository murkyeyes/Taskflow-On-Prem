const env = require('../config/env');
const HttpError = require('../utils/httpError');

const allowedMethods = 'GET,HEAD,POST,PATCH,DELETE,OPTIONS';
const allowedHeaders = 'Content-Type';

function corsMiddleware(request, response, next) {
  const origin = request.get('origin');
  if (!origin) return next();

  const normalizedOrigin = origin.replace(/\/$/, '');
  if (!env.corsAllowedOrigins.includes(normalizedOrigin)) {
    return next(new HttpError(403, 'CORS_ORIGIN_DENIED', 'Request origin is not allowed'));
  }

  response.vary('Origin');
  response.set('Access-Control-Allow-Origin', normalizedOrigin);
  response.set('Access-Control-Allow-Credentials', 'true');
  response.set('Access-Control-Allow-Methods', allowedMethods);
  response.set('Access-Control-Allow-Headers', allowedHeaders);
  response.set('Access-Control-Max-Age', '600');

  if (request.method === 'OPTIONS') return response.status(204).send();
  return next();
}

module.exports = corsMiddleware;
