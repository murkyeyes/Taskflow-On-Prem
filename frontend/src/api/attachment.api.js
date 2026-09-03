import { ApiError, apiRequest, apiUrl, jsonBody } from './client';

export const listAttachments = (issueKey) => apiRequest(`/issues/${encodeURIComponent(issueKey)}/attachments`);

async function checkedResponse(response) {
  if (response.ok) return response;
  let body = {};
  try { body = await response.json(); } catch { /* use fallback below */ }
  throw new ApiError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'Request failed');
}

export const createAttachmentLink = (issueKey, data) => apiRequest(`/issues/${encodeURIComponent(issueKey)}/attachments`, { method: 'POST', body: jsonBody(data) });

export async function downloadAttachment(attachment) {
  const response = await checkedResponse(await fetch(apiUrl(`/attachments/${attachment.id}/download`), { credentials: 'include' }));
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
