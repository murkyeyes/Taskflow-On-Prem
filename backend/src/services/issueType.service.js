const issueTypeRepository = require('../repositories/issueType.repository');
const HttpError = require('../utils/httpError');

async function listIssueTypes(projectId) {
  return issueTypeRepository.list(projectId);
}

async function createIssueType(projectId, data) {
  try {
    return await issueTypeRepository.create(projectId, data);
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'ISSUE_TYPE_CONFLICT', 'An issue type with this name already exists');
    }
    throw error;
  }
}

async function updateIssueType(projectId, id, changes) {
  try {
    const issueType = await issueTypeRepository.update(projectId, id, changes);
    if (!issueType) {
      throw new HttpError(404, 'ISSUE_TYPE_NOT_FOUND', 'Issue type not found');
    }
    return issueType;
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'ISSUE_TYPE_CONFLICT', 'An issue type with this name already exists');
    }
    throw error;
  }
}

async function deleteIssueType(projectId, id) {
  try {
    if (!await issueTypeRepository.remove(projectId, id)) {
      throw new HttpError(404, 'ISSUE_TYPE_NOT_FOUND', 'Issue type not found');
    }
  } catch (error) {
    if (error.code === '23503') {
      throw new HttpError(409, 'ISSUE_TYPE_IN_USE', 'Issue type is currently used by one or more issues');
    }
    throw error;
  }
}

module.exports = {
  createIssueType,
  deleteIssueType,
  listIssueTypes,
  updateIssueType,
};
