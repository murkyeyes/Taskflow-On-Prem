import { apiRequest } from './client';

export const getProjectUpdates = (projectId, since) => apiRequest(
  `/projects/${projectId}/updates?since=${encodeURIComponent(since)}`,
);
