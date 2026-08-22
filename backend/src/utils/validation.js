const HttpError = require('./httpError');

function validationError(message) {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

function requireObject(value, fieldName = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError(`${fieldName} must be an object`);
  }
  return value;
}

function requireString(value, fieldName, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') {
    throw validationError(`${fieldName} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw validationError(`${fieldName} must contain between ${min} and ${max} characters`);
  }
  return normalized;
}

function optionalString(value, fieldName, options = {}) {
  if (value === undefined || value === null) {
    return null;
  }
  return requireString(value, fieldName, options);
}

function requireEmail(value) {
  const email = requireString(value, 'email', { min: 3, max: 255 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError('email must be a valid email address');
  }
  return email;
}

function requireInteger(value, fieldName, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw validationError(`${fieldName} must be an integer between ${min} and ${max}`);
  }
  return number;
}

function optionalInteger(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireInteger(value, fieldName, options);
}

function requireEnum(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw validationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
  return value;
}

function optionalBoolean(value, fieldName, fallback = undefined) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw validationError(`${fieldName} must be a boolean`);
  }
  return value;
}

function parsePagination(query) {
  return {
    page: optionalInteger(query.page, 'page', { min: 1, max: 1_000_000 }) ?? 1,
    pageSize: optionalInteger(query.pageSize, 'pageSize', { min: 1, max: 100 }) ?? 25,
  };
}

module.exports = {
  optionalBoolean,
  optionalInteger,
  optionalString,
  parsePagination,
  requireEmail,
  requireEnum,
  requireInteger,
  requireObject,
  requireString,
};
