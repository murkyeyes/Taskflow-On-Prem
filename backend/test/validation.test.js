const assert = require('node:assert/strict');
const test = require('node:test');

const validation = require('../src/utils/validation');

test('normalizes common valid API inputs', () => {
  assert.equal(validation.requireString('  Project  ', 'name'), 'Project');
  assert.equal(validation.requireEmail(' User@Example.com '), 'user@example.com');
  assert.equal(validation.requireInteger('42', 'projectId', { min: 1 }), 42);
  assert.equal(validation.requireEnum('member', 'projectRole', ['admin', 'member', 'viewer']), 'member');
  assert.deepEqual(validation.parsePagination({ page: '2', pageSize: '50' }), { page: 2, pageSize: 50 });
});

test('rejects malformed API inputs with a standardized validation error', () => {
  for (const operation of [
    () => validation.requireObject(null),
    () => validation.requireEmail('not-an-email'),
    () => validation.requireInteger('1.5', 'projectId', { min: 1 }),
    () => validation.requireEnum('owner', 'projectRole', ['admin', 'member', 'viewer']),
    () => validation.parsePagination({ pageSize: '101' }),
  ]) {
    assert.throws(operation, { status: 400, code: 'VALIDATION_ERROR' });
  }
});
