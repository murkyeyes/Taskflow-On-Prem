const issueRepository = require('../repositories/issue.repository');
const issueSequenceRepository = require('../repositories/issueSequence.repository');
const issueStatusHistoryRepository = require('../repositories/issueStatusHistory.repository');
const issueTypeRepository = require('../repositories/issueType.repository');
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

async function createIssue(projectId, data, reporterId) {
  try {
    return await withTransaction(async (client) => {
      const project = await projectRepository.lockById(projectId, client);
      if (!project) {
        throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
      }
      if (!await issueTypeRepository.findById(projectId, data.issueTypeId, client)) {
        throw new HttpError(400, 'ISSUE_TYPE_PROJECT_MISMATCH', 'Issue type does not belong to this project');
      }
      const defaultStatus = await workflowStatusRepository.findDefault(projectId, client);
      if (!defaultStatus) {
        throw new HttpError(409, 'DEFAULT_STATUS_MISSING', 'Project does not have a default workflow status');
      }

      const nextNumber = await issueSequenceRepository.incrementAndGet(client, projectId);
      const issue = await issueRepository.create({
        projectId,
        issueKey: formatIssueKey(project.key, nextNumber),
        title: data.title,
        description: data.description,
        issueTypeId: data.issueTypeId,
        statusId: defaultStatus.id,
        reporterId,
        assigneeId: data.assigneeId,
        priority: data.priority,
        metadata: {},
      }, client);
      await issueStatusHistoryRepository.create({
        issueId: issue.id,
        fromStatusId: null,
        toStatusId: defaultStatus.id,
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

async function updateIssue(issueKey, changes) {
  try {
    return await withTransaction(async (client) => {
      const current = await issueRepository.lockByKey(issueKey, client);
      if (!current) {
        throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
      }
      if (changes.issueTypeId !== undefined && !await issueTypeRepository.findById(current.project_id, changes.issueTypeId, client)) {
        throw new HttpError(400, 'ISSUE_TYPE_PROJECT_MISMATCH', 'Issue type does not belong to this project');
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

async function changeStatus(issueKey, statusId, changedBy) {
  return withTransaction(async (client) => {
    const current = await issueRepository.lockByKey(issueKey, client);
    if (!current) {
      throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    }
    if (!await workflowStatusRepository.findById(current.project_id, statusId, client)) {
      throw new HttpError(400, 'STATUS_PROJECT_MISMATCH', 'Workflow status does not belong to this project');
    }
    const updated = await issueRepository.updateStatus(issueKey, statusId, client);
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
