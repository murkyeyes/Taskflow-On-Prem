const assert = require('node:assert/strict');
const test = require('node:test');

const { validateFile } = require('../src/utils/attachmentFile.util');

const pdf = Buffer.from('%PDF-1.4\n%%EOF');
const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);

test('accepts valid PDF, Word, and Excel report signatures', () => {
  assert.equal(validateFile('report.pdf', 'application/pdf', pdf).fileName, 'report.pdf');
  assert.equal(validateFile('report.doc', 'application/msword', ole).fileName, 'report.doc');
  assert.equal(validateFile('report.xls', 'application/vnd.ms-excel', ole).fileName, 'report.xls');
  assert.equal(validateFile('report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip).fileName, 'report.docx');
  assert.equal(validateFile('report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip).fileName, 'report.xlsx');
});

test('rejects unsupported, spoofed, empty, and oversized report files', () => {
  assert.throws(() => validateFile('report.txt', 'text/plain', Buffer.from('hello')), { status: 415, code: 'UNSUPPORTED_REPORT_FILE' });
  assert.throws(() => validateFile('report.pdf', 'application/pdf', Buffer.from('not a pdf')), { status: 415, code: 'UNSUPPORTED_REPORT_FILE' });
  assert.throws(() => validateFile('report.pdf', 'application/pdf', Buffer.alloc(0)), { status: 400, code: 'EMPTY_FILE' });
  assert.throws(() => validateFile('report.pdf', 'application/pdf', Buffer.alloc(10 * 1024 * 1024 + 1)), { status: 413, code: 'FILE_TOO_LARGE' });
});
