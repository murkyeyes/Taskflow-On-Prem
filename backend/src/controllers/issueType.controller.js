const issueTypeService = require('../services/issueType.service');
const HttpError = require('../utils/httpError');
const {
  optionalString,
  requireInteger,
  requireObject,
  requireString,
} = require('../utils/validation');

async function list(request, response) {
  response.json({ issueTypes: await issueTypeService.listIssueTypes(request.projectId) });
}

async function create(request, response) {
  const body = requireObject(request.body);
  const issueType = await issueTypeService.createIssueType(request.projectId, {
    name: requireString(body.name, 'name', { min: 1, max: 50 }),
    color: optionalString(body.color, 'color', { min: 1, max: 20 }),
  });
  response.status(201).json({ issueType });
}

async function update(request, response) {
  const body = requireObject(request.body);
  const changes = {};
  if (body.name !== undefined) {
    changes.name = requireString(body.name, 'name', { min: 1, max: 50 });
  }
  if (body.color !== undefined) {
    changes.color = optionalString(body.color, 'color', { min: 1, max: 20 });
  }
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'At least one issue type field must be provided');
  }
  const issueType = await issueTypeService.updateIssueType(
    request.projectId,
    requireInteger(request.params.id, 'id', { min: 1 }),
    changes,
  );
  response.json({ issueType });
}

async function remove(request, response) {
  await issueTypeService.deleteIssueType(
    request.projectId,
    requireInteger(request.params.id, 'id', { min: 1 }),
  );
  response.status(204).send();
}

module.exports = {
  create,
  list,
  remove,
  update,
};
