const assert = require('node:assert/strict');
const test = require('node:test');

const { validateReportLink } = require('../src/utils/reportLink.util');

test('accepts HTTPS document links and derives lightweight metadata', () => {
  const result = validateReportLink('https://tenant.sharepoint.com/reports/daily.xlsx?web=1');
  assert.equal(result.title, 'daily.xlsx');
  assert.equal(result.provider, 'Microsoft 365');
  assert.equal(result.mediaType, 'text/uri-list');
});

test('keeps a supplied title and recognizes Google Workspace', () => {
  const result = validateReportLink('https://docs.google.com/spreadsheets/d/abc/edit', 'January report.xlsx');
  assert.equal(result.title, 'January report.xlsx');
  assert.equal(result.provider, 'Google Workspace');
});

test('rejects non-HTTPS, relative, credentialed, and oversized links', () => {
  for (const url of ['http://example.com/report.xlsx', '/report.xlsx', 'javascript:alert(1)', 'https://user:pass@example.com/report.xlsx', `https://example.com/${'a'.repeat(2050)}`]) {
    assert.throws(() => validateReportLink(url));
  }
});
