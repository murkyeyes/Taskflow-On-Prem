import { apiRequest, jsonBody } from './client';

export const listComments = (issueKey) => apiRequest(`/issues/${encodeURIComponent(issueKey)}/comments`);
export const createComment = (issueKey, content) => apiRequest(`/issues/${encodeURIComponent(issueKey)}/comments`, { method: 'POST', body: jsonBody({ content }) });
export const updateComment = (id, content) => apiRequest(`/comments/${id}`, { method: 'PATCH', body: jsonBody({ content }) });
export const deleteComment = (id) => apiRequest(`/comments/${id}`, { method: 'DELETE' });
