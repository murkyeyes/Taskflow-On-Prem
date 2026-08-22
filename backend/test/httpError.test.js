const assert = require('node:assert/strict');
const test = require('node:test');

const HttpError = require('../src/utils/httpError');

test('carries the standardized HTTP status, code, and message', () => {
  const error = new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  assert.equal(error.name, 'HttpError');
  assert.equal(error.status, 404);
  assert.equal(error.code, 'PROJECT_NOT_FOUND');
  assert.equal(error.message, 'Project not found');
  assert.equal(error instanceof Error, true);
});
