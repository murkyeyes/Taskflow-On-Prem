import { apiRequest, jsonBody } from './client';

export const listProjects = () => apiRequest('/projects');
export const createProject = (data) => apiRequest('/projects', { method: 'POST', body: jsonBody(data) });
export const getProject = (projectId) => apiRequest(`/projects/${projectId}`);
export const updateProject = (projectId, data) => apiRequest(`/projects/${projectId}`, { method: 'PATCH', body: jsonBody(data) });
export const deleteProject = (projectId) => apiRequest(`/projects/${projectId}`, { method: 'DELETE' });

export const listMembers = (projectId) => apiRequest(`/projects/${projectId}/members`);
export const addMember = (projectId, data) => apiRequest(`/projects/${projectId}/members`, { method: 'POST', body: jsonBody(data) });
export const updateMember = (projectId, userId, data) => apiRequest(`/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: jsonBody(data) });
export const deleteMember = (projectId, userId) => apiRequest(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });

export const listIssueTypes = (projectId) => apiRequest(`/projects/${projectId}/issue-types`);
export const createIssueType = (projectId, data) => apiRequest(`/projects/${projectId}/issue-types`, { method: 'POST', body: jsonBody(data) });
export const updateIssueType = (projectId, id, data) => apiRequest(`/projects/${projectId}/issue-types/${id}`, { method: 'PATCH', body: jsonBody(data) });
export const deleteIssueType = (projectId, id) => apiRequest(`/projects/${projectId}/issue-types/${id}`, { method: 'DELETE' });

export const listWorkflowStatuses = (projectId) => apiRequest(`/projects/${projectId}/workflow-statuses`);
export const createWorkflowStatus = (projectId, data) => apiRequest(`/projects/${projectId}/workflow-statuses`, { method: 'POST', body: jsonBody(data) });
export const updateWorkflowStatus = (projectId, id, data) => apiRequest(`/projects/${projectId}/workflow-statuses/${id}`, { method: 'PATCH', body: jsonBody(data) });
export const reorderWorkflowStatuses = (projectId, orderedIds) => apiRequest(`/projects/${projectId}/workflow-statuses/reorder`, { method: 'PATCH', body: jsonBody({ orderedIds }) });
export const deleteWorkflowStatus = (projectId, id) => apiRequest(`/projects/${projectId}/workflow-statuses/${id}`, { method: 'DELETE' });
