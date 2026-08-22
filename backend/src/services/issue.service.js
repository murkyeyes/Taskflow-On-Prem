const issueRepository = require('../repositories/issue.repository');
const issueSequenceRepository = require('../repositories/issueSequence.repository');
const issueStatusHistoryRepository = require('../repositories/issueStatusHistory.repository');
const issueTypeRepository = require('../repositories/issueType.repository');
const memberRepository = require('../repositories/member.repository');
const projectRepository = require('../repositories/project.repository');
const workflowStatusRepository = require('../repositories/workflowStatus.repository');
const HttpError = require('../utils/httpError');
const formatIssueKey = require('../utils/issueKey.util');
const withTransaction = require('../utils/withTransaction');

async function listIssues(projectId, filters, pagination) {
  const result = await issueRepository.list(projectId, filters, pagination);
  return {
    ...result,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

function enforceAssignment(projectRole, actorId, assigneeId, currentAssigneeId = null) {
  if (projectRole === 'admin' || assigneeId === null || assigneeId === actorId || assigneeId === currentAssigneeId) return;
  throw new HttpError(403, 'SELF_ASSIGNMENT_ONLY', 'Members may assign an issue only to themselves');
}

async function requireMutableIssue(current, projectRole, client) {
  const currentStatus = await workflowStatusRepository.findById(current.project_id, current.status_id, client);
  if (currentStatus?.is_final && projectRole !== 'admin') {
    throw new HttpError(403, 'COMPLETED_ISSUE_LOCKED', 'Only an Admin can edit a completed issue');
  }
  return currentStatus;
}

async function createIssue(projectId, data, reporterId, projectRole) {
  try {
    return await withTransaction(async (client) => {
      const project = await projectRepository.lockById(projectId, client);
      if (!project) {
        throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
      }
      if (!await issueTypeRepository.findById(projectId, data.issueTypeId, client)) {
        throw new HttpError(400, 'ISSUE_TYPE_PROJECT_MISMATCH', 'Issue type does not belong to this project');
      }
      enforceAssignment(projectRole, reporterId, data.assigneeId);
      if (data.assigneeId !== null && !await memberRepository.findRoleByProjectId(projectId, data.assigneeId, client)) {
        throw new HttpError(400, 'ASSIGNEE_PROJECT_MISMATCH', 'Assignee must be a member of this project');
      }
      const selectedStatus = data.statusId === null
        ? await workflowStatusRepository.findDefault(projectId, client)
        : await workflowStatusRepository.findById(projectId, data.statusId, client);
      if (!selectedStatus) {
        if (data.statusId !== null) throw new HttpError(400, 'STATUS_PROJECT_MISMATCH', 'Workflow status does not belong to this project');
        throw new HttpError(409, 'DEFAULT_STATUS_MISSING', 'Project does not have a default workflow status');
      }

      const nextNumber = await issueSequenceRepository.incrementAndGet(client, projectId);
      const issue = await issueRepository.create({
        projectId,
        issueKey: formatIssueKey(project.key, nextNumber),
        title: data.title,
        description: data.description,
        issueTypeId: data.issueTypeId,
        statusId: selectedStatus.id,
        reporterId,
        assigneeId: data.assigneeId,
        priority: data.priority,
        dueDate: data.dueDate,
        isFinal: selectedStatus.is_final,
        metadata: {},
      }, client);
      await issueStatusHistoryRepository.create({
        issueId: issue.id,
        fromStatusId: null,
        toStatusId: selectedStatus.id,
        changedBy: reporterId,
      }, client);
      return issue;
    });
  } catch (error) {
    if (error.code === '23503') {
      throw new HttpError(400, 'INVALID_ISSUE_REFERENCE', 'Assignee or another issue reference is invalid');
    }
    throw error;
  }
}

async function getIssue(issueKey) {
  const issue = await issueRepository.findByKey(issueKey);
  if (!issue) {
    throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  }
  return issue;
}

async function updateIssue(issueKey, changes, actorId, projectRole) {
  try {
    return await withTransaction(async (client) => {
      const current = await issueRepository.lockByKey(issueKey, client);
      if (!current) {
        throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
      }
      await requireMutableIssue(current, projectRole, client);
      if (changes.issueTypeId !== undefined && !await issueTypeRepository.findById(current.project_id, changes.issueTypeId, client)) {
        throw new HttpError(400, 'ISSUE_TYPE_PROJECT_MISMATCH', 'Issue type does not belong to this project');
      }
      if (changes.assigneeId !== undefined) {
        enforceAssignment(projectRole, actorId, changes.assigneeId, current.assignee_id);
        if (changes.assigneeId !== null && !await memberRepository.findRoleByProjectId(current.project_id, changes.assigneeId, client)) {
          throw new HttpError(400, 'ASSIGNEE_PROJECT_MISMATCH', 'Assignee must be a member of this project');
        }
      }
      return issueRepository.update(issueKey, changes, client);
    });
  } catch (error) {
    if (error.code === '23503') {
      throw new HttpError(400, 'INVALID_ISSUE_REFERENCE', 'Assignee or another issue reference is invalid');
    }
    throw error;
  }
}

async function changeStatus(issueKey, statusId, changedBy, projectRole) {
  return withTransaction(async (client) => {
    const current = await issueRepository.lockByKey(issueKey, client);
    if (!current) {
      throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    }
    await requireMutableIssue(current, projectRole, client);
    const targetStatus = await workflowStatusRepository.findById(current.project_id, statusId, client);
    if (!targetStatus) {
      throw new HttpError(400, 'STATUS_PROJECT_MISMATCH', 'Workflow status does not belong to this project');
    }
    const updated = await issueRepository.updateStatus(issueKey, statusId, targetStatus.is_final, client);
    await issueStatusHistoryRepository.create({
      issueId: current.id,
      fromStatusId: current.status_id,
      toStatusId: statusId,
      changedBy,
    }, client);
    return updated;
  });
}

async function deleteIssue(issueKey) {
  if (!await issueRepository.remove(issueKey)) {
    throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  }
}

module.exports = {
  changeStatus,
  createIssue,
  deleteIssue,
  getIssue,
  listIssues,
  updateIssue,
};
