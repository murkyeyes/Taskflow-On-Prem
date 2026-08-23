const HttpError = require('../utils/httpError');

function notFoundHandler(request, response, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found'));
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const isHttpError = error instanceof HttpError;
  const isBodyTooLarge = error?.type === 'entity.too.large';
  const status = isHttpError ? error.status : isBodyTooLarge ? 413 : 500;
  const code = isHttpError ? error.code : isBodyTooLarge ? 'FILE_TOO_LARGE' : 'INTERNAL_ERROR';
  const message = isHttpError ? error.message : isBodyTooLarge ? 'Report files may not exceed 10 MiB' : 'Internal server error';

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
