const HttpError = require('../utils/httpError');

function notFoundHandler(request, response, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found'));
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const isHttpError = error instanceof HttpError;
  const status = isHttpError ? error.status : 500;
  const code = isHttpError ? error.code : 'INTERNAL_ERROR';
  const message = isHttpError ? error.message : 'Internal server error';

  return response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
