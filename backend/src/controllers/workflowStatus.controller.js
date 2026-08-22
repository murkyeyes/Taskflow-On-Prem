const workflowStatusService = require('../services/workflowStatus.service');
const HttpError = require('../utils/httpError');
const {
  optionalBoolean,
  requireInteger,
  requireObject,
  requireString,
} = require('../utils/validation');

async function list(request, response) {
  response.json({ workflowStatuses: await workflowStatusService.listWorkflowStatuses(request.projectId) });
}

async function create(request, response) {
  const body = requireObject(request.body);
  const workflowStatus = await workflowStatusService.createWorkflowStatus(request.projectId, {
    name: requireString(body.name, 'name', { min: 1, max: 50 }),
    position: requireInteger(body.position, 'position', { min: 0, max: 10_000 }),
    isDefault: optionalBoolean(body.isDefault, 'isDefault', false),
    isFinal: optionalBoolean(body.isFinal, 'isFinal', false),
  });
  response.status(201).json({ workflowStatus });
}

async function update(request, response) {
  const body = requireObject(request.body);
  const changes = {};
  if (body.name !== undefined) changes.name = requireString(body.name, 'name', { min: 1, max: 50 });
  if (body.position !== undefined) changes.position = requireInteger(body.position, 'position', { min: 0, max: 10_000 });
  if (body.isDefault !== undefined) changes.isDefault = optionalBoolean(body.isDefault, 'isDefault');
  if (body.isFinal !== undefined) changes.isFinal = optionalBoolean(body.isFinal, 'isFinal');
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'At least one workflow status field must be provided');
  }
  const workflowStatus = await workflowStatusService.updateWorkflowStatus(
    request.projectId,
    requireInteger(request.params.id, 'id', { min: 1 }),
    changes,
  );
  response.json({ workflowStatus });
}

async function reorder(request, response) {
  const body = requireObject(request.body);
  if (!Array.isArray(body.orderedIds)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'orderedIds must be an array');
  }
  const orderedIds = body.orderedIds.map((id) => requireInteger(id, 'orderedIds item', { min: 1 }));
  response.json({
    workflowStatuses: await workflowStatusService.reorderWorkflowStatuses(request.projectId, orderedIds),
  });
}

async function remove(request, response) {
  await workflowStatusService.deleteWorkflowStatus(
    request.projectId,
    requireInteger(request.params.id, 'id', { min: 1 }),
  );
  response.status(204).send();
}

module.exports = {
  create,
  list,
  remove,
  reorder,
  update,
};
