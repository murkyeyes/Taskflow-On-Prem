const path = require('node:path');

const HttpError = require('./httpError');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedFiles = {
  '.pdf': { mediaTypes: ['application/pdf', 'application/octet-stream'], signature: 'pdf' },
  '.doc': { mediaTypes: ['application/msword', 'application/octet-stream'], signature: 'ole' },
  '.xls': { mediaTypes: ['application/vnd.ms-excel', 'application/octet-stream'], signature: 'ole' },
  '.docx': { mediaTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'], signature: 'zip' },
  '.xlsx': { mediaTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'], signature: 'zip' },
};

function hasSignature(buffer, signature) {
  if (signature === 'pdf') return buffer.subarray(0, 5).equals(Buffer.from('%PDF-'));
  if (signature === 'ole') return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && [[0x03, 0x04], [0x05, 0x06], [0x07, 0x08]].some(([third, fourth]) => buffer[2] === third && buffer[3] === fourth);
}

function validateFile(fileName, mediaType, fileData) {
  const safeName = path.posix.basename(path.win32.basename(String(fileName ?? ''))).trim();
  if (!safeName || safeName.length > 255 || /[\x00-\x1f\x7f]/.test(safeName)) throw new HttpError(400, 'INVALID_FILE_NAME', 'File name must contain between 1 and 255 safe characters');
  if (!Buffer.isBuffer(fileData) || fileData.length === 0) throw new HttpError(400, 'EMPTY_FILE', 'Choose a non-empty report file');
  if (fileData.length > MAX_FILE_SIZE) throw new HttpError(413, 'FILE_TOO_LARGE', 'Report files may not exceed 10 MiB');
  const extension = path.extname(safeName).toLowerCase();
  const rule = allowedFiles[extension];
  const normalizedType = String(mediaType ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!rule || !rule.mediaTypes.includes(normalizedType) || !hasSignature(fileData, rule.signature)) {
    throw new HttpError(415, 'UNSUPPORTED_REPORT_FILE', 'Only valid PDF, Word, and Excel report files are allowed');
  }
  return { fileName: safeName, mediaType: normalizedType };
}

module.exports = { MAX_FILE_SIZE, validateFile };
