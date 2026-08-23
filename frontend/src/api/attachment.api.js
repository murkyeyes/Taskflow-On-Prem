import { ApiError, apiRequest } from './client';

export const listAttachments = (issueKey) => apiRequest(`/issues/${encodeURIComponent(issueKey)}/attachments`);

async function checkedResponse(response) {
  if (response.ok) return response;
  let body = {};
  try { body = await response.json(); } catch { /* use fallback below */ }
  throw new ApiError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'Request failed');
}

function mediaTypeFor(file) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }[extension] ?? 'application/octet-stream';
}

export async function uploadAttachment(issueKey, file) {
  const response = await checkedResponse(await fetch(`/api/issues/${encodeURIComponent(issueKey)}/attachments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': mediaTypeFor(file), 'x-file-name': encodeURIComponent(file.name) },
    body: file,
  }));
  return response.json();
}

export async function downloadAttachment(attachment) {
  const response = await checkedResponse(await fetch(`/api/attachments/${attachment.id}/download`, { credentials: 'include' }));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.file_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const deleteAttachment = (id) => apiRequest(`/attachments/${id}`, { method: 'DELETE' });
