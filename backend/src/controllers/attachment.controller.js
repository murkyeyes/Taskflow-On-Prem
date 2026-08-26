const attachmentService = require('../services/attachment.service');
const { requireInteger } = require('../utils/validation');

async function list(request, response) {
  response.json({ attachments: await attachmentService.listAttachments(request.params.issueKey) });
}

async function createLink(request, response) {
  const attachment = await attachmentService.createAttachmentLink(request.params.issueKey, request.user.userId, request.projectRole, request.body);
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

module.exports = { createLink, download, list, remove };
