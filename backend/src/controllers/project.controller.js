const projectService = require('../services/project.service');
const HttpError = require('../utils/httpError');
const {
  optionalString,
  requireInteger,
  requireObject,
  requireString,
} = require('../utils/validation');

function normalizeProjectKey(value) {
  const key = requireString(value, 'key', { min: 1, max: 10 }).toUpperCase();
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(key)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'key must start with a letter and contain only letters or numbers');
  }
  return key;
}

async function list(request, response) {
  response.json({ projects: await projectService.listProjects(request.user.userId) });
}

async function create(request, response) {
  const body = requireObject(request.body);
  if (body.viewerIds !== undefined && !Array.isArray(body.viewerIds)) throw new HttpError(400, 'VALIDATION_ERROR', 'viewerIds must be an array');
  const viewerIds = [...new Set((body.viewerIds ?? []).map((id) => requireInteger(id, 'viewerIds item', { min: 1 })))];
  if (viewerIds.length > 100) throw new HttpError(400, 'VALIDATION_ERROR', 'viewerIds must contain at most 100 accounts');
  const project = await projectService.createProject({
    key: normalizeProjectKey(body.key),
    name: requireString(body.name, 'name', { min: 1, max: 200 }),
    description: optionalString(body.description, 'description', { min: 1, max: 10_000 }),
    viewerIds,
  }, request.user.userId);
  response.status(201).json({ project });
}

async function get(request, response) {
  response.json({ project: await projectService.getProject(request.projectId) });
}

async function update(request, response) {
  const body = requireObject(request.body);
  const changes = {};
  if (body.name !== undefined) {
    changes.name = requireString(body.name, 'name', { min: 1, max: 200 });
  }
  if (body.description !== undefined) {
    changes.description = optionalString(body.description, 'description', { min: 1, max: 10_000 });
  }
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'At least one project field must be provided');
  }
  response.json({ project: await projectService.updateProject(request.projectId, changes) });
}

async function remove(request, response) {
  await projectService.deleteProject(request.projectId);
  response.status(204).send();
}

module.exports = {
  create,
  get,
  list,
  remove,
  update,
};
