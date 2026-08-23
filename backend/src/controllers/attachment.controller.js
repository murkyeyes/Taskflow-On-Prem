const attachmentService = require('../services/attachment.service');
const HttpError = require('../utils/httpError');
const { requireInteger } = require('../utils/validation');

function decodeFileName(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'FILE_NAME_REQUIRED', 'X-File-Name header is required');
  try { return decodeURIComponent(value); } catch { throw new HttpError(400, 'INVALID_FILE_NAME', 'X-File-Name must be URI encoded'); }
}

async function list(request, response) {
  response.json({ attachments: await attachmentService.listAttachments(request.params.issueKey) });
}

async function upload(request, response) {
  const attachment = await attachmentService.uploadAttachment(request.params.issueKey, request.user.userId, request.projectRole, {
    fileName: decodeFileName(request.get('x-file-name')),
    mediaType: request.get('content-type'),
    fileData: request.body,
  });
  response.status(201).json({ attachment });
}

function contentDisposition(fileName) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

async function download(request, response) {
  const attachment = await attachmentService.downloadAttachment(requireInteger(request.params.id, 'id', { min: 1 }), request.user.userId);
  response.set({
    'content-type': attachment.media_type,
    'content-length': String(attachment.file_size),
    'content-disposition': contentDisposition(attachment.file_name),
    'cache-control': 'private, no-store',
  });
  response.send(attachment.file_data);
}

async function remove(request, response) {
  await attachmentService.deleteAttachment(requireInteger(request.params.id, 'id', { min: 1 }), request.user.userId);
  response.status(204).send();
}

module.exports = { download, list, remove, upload };
