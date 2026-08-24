import { apiRequest, jsonBody } from './client';
export const getPreferences = () => apiRequest('/settings/me');
export const updatePreferences = (data) => apiRequest('/settings/me', { method: 'PATCH', body: jsonBody(data) });
export const changePassword = (data) => apiRequest('/settings/me/password', { method: 'PATCH', body: jsonBody(data) });
export const getSystem = () => apiRequest('/settings/system');
export const updateSystem = (data) => apiRequest('/settings/system', { method: 'PATCH', body: jsonBody(data) });
export const listTemplates = () => apiRequest('/settings/templates');
