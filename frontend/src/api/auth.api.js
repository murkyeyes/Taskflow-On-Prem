import { apiRequest, jsonBody } from './client';

export const getCurrentUser = () => apiRequest('/auth/me');
export const login = (credentials) => apiRequest('/auth/login', {
  method: 'POST', body: jsonBody(credentials),
});
export const logout = () => apiRequest('/auth/logout', { method: 'POST' });
export const register = (data) => apiRequest('/auth/register', {
  method: 'POST', body: jsonBody(data),
});
export const listUsers = (search = '') => apiRequest(`/auth/users${search ? `?${new URLSearchParams({ search })}` : ''}`);
