const workflowStatusRepository = require('../repositories/workflowStatus.repository');
const HttpError = require('../utils/httpError');
const withTransaction = require('../utils/withTransaction');

async function listWorkflowStatuses(projectId) {
  return workflowStatusRepository.list(projectId);
}

async function createWorkflowStatus(projectId, data) {
  try {
    return await withTransaction(async (client) => {
      if (data.isDefault) {
        await workflowStatusRepository.clearDefault(projectId, client);
      }
      return workflowStatusRepository.create(projectId, data, client);
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'WORKFLOW_STATUS_CONFLICT', 'A workflow status with this name already exists');
    }
    throw error;
  }
}

async function updateWorkflowStatus(projectId, id, changes) {
  try {
    return await withTransaction(async (client) => {
      if (changes.isDefault === true) {
        await workflowStatusRepository.clearDefault(projectId, client);
      }
      const status = await workflowStatusRepository.update(projectId, id, changes, client);
      if (!status) {
        throw new HttpError(404, 'WORKFLOW_STATUS_NOT_FOUND', 'Workflow status not found');
      }
      return status;
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'WORKFLOW_STATUS_CONFLICT', 'A workflow status with this name already exists');
    }
    throw error;
  }
}

async function reorderWorkflowStatuses(projectId, orderedIds) {
  const statuses = await workflowStatusRepository.list(projectId);
  const currentIds = new Set(statuses.map((status) => status.id));
  if (orderedIds.length !== currentIds.size || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((id) => !currentIds.has(id))) {
    throw new HttpError(400, 'INVALID_STATUS_ORDER', 'orderedIds must contain every project workflow status exactly once');
  }

  await withTransaction(async (client) => {
    for (const [position, id] of orderedIds.entries()) {
      await workflowStatusRepository.updatePosition(projectId, id, position, client);
    }
  });
  return workflowStatusRepository.list(projectId);
}

async function deleteWorkflowStatus(projectId, id) {
  try {
    if (!await workflowStatusRepository.remove(projectId, id)) {
      throw new HttpError(404, 'WORKFLOW_STATUS_NOT_FOUND', 'Workflow status not found');
    }
  } catch (error) {
    if (error.code === '23503') {
      throw new HttpError(409, 'WORKFLOW_STATUS_IN_USE', 'Workflow status is currently used by one or more issues');
    }
    throw error;
  }
}

module.exports = {
  createWorkflowStatus,
  deleteWorkflowStatus,
  listWorkflowStatuses,
  reorderWorkflowStatuses,
  updateWorkflowStatus,
};
