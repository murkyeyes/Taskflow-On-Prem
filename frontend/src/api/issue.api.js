import { apiRequest, jsonBody } from './client';

export function listIssues(projectId, filters = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== null && value !== undefined && value !== ''));
  return apiRequest(`/projects/${projectId}/issues?${query}`);
}
export const createIssue = (projectId, data) => apiRequest(`/projects/${projectId}/issues`, { method: 'POST', body: jsonBody(data) });
export const getIssue = (issueKey) => apiRequest(`/issues/${encodeURIComponent(issueKey)}`);
export const updateIssue = (issueKey, data) => apiRequest(`/issues/${encodeURIComponent(issueKey)}`, { method: 'PATCH', body: jsonBody(data) });
export const updateIssueStatus = (issueKey, statusId) => apiRequest(`/issues/${encodeURIComponent(issueKey)}/status`, { method: 'PATCH', body: jsonBody({ statusId }) });
export const deleteIssue = (issueKey) => apiRequest(`/issues/${encodeURIComponent(issueKey)}`, { method: 'DELETE' });
