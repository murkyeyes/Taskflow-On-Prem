import { apiRequest, jsonBody } from './client';

export const getSummary = (projectId) => apiRequest(`/projects/${projectId}/summary`);
export const listSprints = (projectId) => apiRequest(`/projects/${projectId}/sprints`);
export const createSprint = (projectId, data) => apiRequest(`/projects/${projectId}/sprints`, { method: 'POST', body: jsonBody(data) });
export const updateSprint = (projectId, id, data) => apiRequest(`/projects/${projectId}/sprints/${id}`, { method: 'PATCH', body: jsonBody(data) });
export const deleteSprint = (projectId, id) => apiRequest(`/projects/${projectId}/sprints/${id}`, { method: 'DELETE' });
export const completeSprint = (projectId, id) => apiRequest(`/projects/${projectId}/sprints/${id}/complete`, { method: 'POST' });
export const updatePlanning = (issueKey, data) => apiRequest(`/issues/${encodeURIComponent(issueKey)}/planning`, { method: 'PATCH', body: jsonBody(data) });

export const listDevelopmentLinks = (projectId) => apiRequest(`/projects/${projectId}/development-links`);
export const createDevelopmentLink = (projectId, data) => apiRequest(`/projects/${projectId}/development-links`, { method: 'POST', body: jsonBody(data) });
export const deleteDevelopmentLink = (projectId, id) => apiRequest(`/projects/${projectId}/development-links/${id}`, { method: 'DELETE' });

export const listDocs = (projectId) => apiRequest(`/projects/${projectId}/docs`);
export const createDoc = (projectId, data) => apiRequest(`/projects/${projectId}/docs`, { method: 'POST', body: jsonBody(data) });
export const updateDoc = (projectId, id, data) => apiRequest(`/projects/${projectId}/docs/${id}`, { method: 'PATCH', body: jsonBody(data) });
export const deleteDoc = (projectId, id) => apiRequest(`/projects/${projectId}/docs/${id}`, { method: 'DELETE' });

export const listForms = (projectId) => apiRequest(`/projects/${projectId}/forms`);
export const createForm = (projectId, data) => apiRequest(`/projects/${projectId}/forms`, { method: 'POST', body: jsonBody(data) });
export const updateForm = (projectId, id, data) => apiRequest(`/projects/${projectId}/forms/${id}`, { method: 'PATCH', body: jsonBody(data) });
export const deleteForm = (projectId, id) => apiRequest(`/projects/${projectId}/forms/${id}`, { method: 'DELETE' });
export const submitForm = (projectId, id, answers) => apiRequest(`/projects/${projectId}/forms/${id}/submissions`, { method: 'POST', body: jsonBody({ answers }) });
export const listSubmissions = (projectId, id) => apiRequest(`/projects/${projectId}/forms/${id}/submissions`);
