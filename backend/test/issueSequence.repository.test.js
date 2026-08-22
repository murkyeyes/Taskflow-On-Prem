const assert = require('node:assert/strict');
const test = require('node:test');

const issueSequenceRepository = require('../src/repositories/issueSequence.repository');

test('increments the project sequence atomically with UPDATE RETURNING', async () => {
  let capturedQuery;
  const client = {
    async query(sql, params) {
      capturedQuery = { sql, params };
      return { rowCount: 1, rows: [{ last_number: 7 }] };
    },
  };

  const value = await issueSequenceRepository.incrementAndGet(client, 42);

  assert.equal(value, 7);
  assert.deepEqual(capturedQuery.params, [42]);
  assert.match(capturedQuery.sql, /UPDATE project_issue_sequences/);
  assert.match(capturedQuery.sql, /last_number = last_number \+ 1/);
  assert.match(capturedQuery.sql, /WHERE project_id = \$1/);
  assert.match(capturedQuery.sql, /RETURNING last_number/);
  assert.doesNotMatch(capturedQuery.sql, /SELECT\s+last_number/i);
});

test('rejects when the project sequence does not exist', async () => {
  const client = {
    async query() {
      return { rowCount: 0, rows: [] };
    },
  };

  await assert.rejects(
    issueSequenceRepository.incrementAndGet(client, 99),
    { code: 'PROJECT_ISSUE_SEQUENCE_NOT_FOUND' },
  );
});
