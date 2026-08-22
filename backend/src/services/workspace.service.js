const issueRepository = require('../repositories/issue.repository');
const workspaceRepository = require('../repositories/workspace.repository');
const HttpError = require('../utils/httpError');
const withTransaction = require('../utils/withTransaction');

const notFound = (resource) => new HttpError(404, `${resource.toUpperCase()}_NOT_FOUND`, `${resource} not found`);

async function saveSprint(projectId, sprintId, data, userId) {
  try {
    return await withTransaction(async (client) => {
      await workspaceRepository.lockSprints(projectId, client);
      if (data.status === 'active') {
        const active = (await workspaceRepository.listSprints(projectId, client)).find((sprint) => sprint.status === 'active' && sprint.id !== sprintId);
        if (active) throw new HttpError(409, 'ACTIVE_SPRINT_EXISTS', 'Only one sprint can be active in a project');
      }
      if (sprintId === null) return workspaceRepository.createSprint(projectId, data, userId, client);
      const sprint = await workspaceRepository.updateSprint(projectId, sprintId, data, client);
      if (!sprint) throw notFound('Sprint');
      return sprint;
    });
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'SPRINT_CONFLICT', 'Sprint name already exists or another sprint is active');
    throw error;
  }
}

async function updatePlanning(issueKey, projectId, data) {
  if (data.sprintId !== undefined && data.sprintId !== null && !await workspaceRepository.findSprint(projectId, data.sprintId)) {
    throw new HttpError(400, 'SPRINT_PROJECT_MISMATCH', 'Sprint does not belong to this project');
  }
  const issue = await workspaceRepository.updatePlanning(issueKey, data);
  if (!issue) throw notFound('Issue');
  return issue;
}

async function completeSprint(projectId, sprintId) {
  return withTransaction(async (client) => {
    await workspaceRepository.lockSprints(projectId, client);
    const result = await workspaceRepository.completeSprint(projectId, sprintId, client);
    if (!result) {
      const sprint = await workspaceRepository.findSprint(projectId, sprintId, client);
      if (!sprint) throw notFound('Sprint');
      throw new HttpError(409, 'SPRINT_NOT_ACTIVE', 'Only an active sprint can be completed');
    }
    return result;
  });
}

async function createDevelopmentLink(projectId, data, userId) {
  let issueId = null;
  if (data.issueKey) {
    const issue = await issueRepository.findByKey(data.issueKey);
    if (!issue || issue.project_id !== projectId) throw new HttpError(400, 'ISSUE_PROJECT_MISMATCH', 'Issue does not belong to this project');
    issueId = issue.id;
  }
  return workspaceRepository.createDevelopmentLink(projectId, { ...data, issueId }, userId);
}

async function required(result, resource) {
  const value = await result;
  if (!value) throw notFound(resource);
  return value;
}

async function submitForm(projectId, formId, answers, userId) {
  const form = await workspaceRepository.findForm(projectId, formId);
  if (!form) throw notFound('Form');
  if (!form.is_active) throw new HttpError(409, 'FORM_INACTIVE', 'This form is not accepting submissions');
  return workspaceRepository.createSubmission(formId, answers, userId);
}

module.exports = {
  createDevelopmentLink,
  completeSprint,
  createDoc: (projectId, data, userId) => workspaceRepository.createDoc(projectId, data, userId),
  createForm: (projectId, data, userId) => workspaceRepository.createForm(projectId, data, userId),
  createSprint: (projectId, data, userId) => saveSprint(projectId, null, data, userId),
  deleteDevelopmentLink: (projectId, id) => required(workspaceRepository.deleteDevelopmentLink(projectId, id), 'Development link'),
  deleteDoc: (projectId, id) => required(workspaceRepository.deleteDoc(projectId, id), 'Document'),
  deleteForm: (projectId, id) => required(workspaceRepository.deleteForm(projectId, id), 'Form'),
  deleteSprint: (projectId, id) => required(workspaceRepository.deleteSprint(projectId, id), 'Sprint'),
  getDoc: (projectId, id) => required(workspaceRepository.findDoc(projectId, id), 'Document'),
  getForm: (projectId, id) => required(workspaceRepository.findForm(projectId, id), 'Form'),
  getSummary: workspaceRepository.getSummary,
  listDevelopmentLinks: workspaceRepository.listDevelopmentLinks,
  listDocs: workspaceRepository.listDocs,
  listForms: workspaceRepository.listForms,
  listSprints: workspaceRepository.listSprints,
  listSubmissions: async (projectId, formId) => {
    await required(workspaceRepository.findForm(projectId, formId), 'Form');
    return workspaceRepository.listSubmissions(projectId, formId);
  },
  submitForm,
  updateDoc: (projectId, id, data, userId) => required(workspaceRepository.updateDoc(projectId, id, data, userId), 'Document'),
  updateForm: (projectId, id, data) => required(workspaceRepository.updateForm(projectId, id, data), 'Form'),
  updatePlanning,
  updateSprint: (projectId, id, data, userId) => saveSprint(projectId, id, data, userId),
};
