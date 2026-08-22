const defaultIssueTypes = require('../db/defaults/defaultIssueTypes');
const defaultWorkflowStatuses = require('../db/defaults/defaultWorkflowStatuses');
const issueSequenceRepository = require('../repositories/issueSequence.repository');
const issueTypeRepository = require('../repositories/issueType.repository');
const memberRepository = require('../repositories/member.repository');
const projectRepository = require('../repositories/project.repository');
const workflowStatusRepository = require('../repositories/workflowStatus.repository');
const userRepository = require('../repositories/user.repository');
const HttpError = require('../utils/httpError');
const withTransaction = require('../utils/withTransaction');

async function listProjects(userId) {
  return projectRepository.listForUser(userId);
}

async function createProject(data, userId, defaults = {}) {
  const issueTypes = defaults.issueTypes ?? defaultIssueTypes;
  const workflowStatuses = defaults.workflowStatuses ?? defaultWorkflowStatuses;

  try {
    return await withTransaction(async (client) => {
      const project = await projectRepository.create({ ...data, createdBy: userId }, client);
      await memberRepository.add(project.id, userId, 'admin', client);
      const viewerIds = (data.viewerIds ?? []).filter((id) => id !== userId);
      const existingViewerIds = await userRepository.findExistingIds(viewerIds, client);
      if (existingViewerIds.length !== viewerIds.length) {
        throw new HttpError(400, 'VIEWER_ACCOUNT_NOT_FOUND', 'One or more selected viewer accounts do not exist');
      }
      for (const viewerId of viewerIds) await memberRepository.add(project.id, viewerId, 'viewer', client);
      await issueSequenceRepository.initialize(client, project.id);

      for (const issueType of issueTypes) {
        await issueTypeRepository.create(project.id, issueType, client);
      }
      for (const workflowStatus of workflowStatuses) {
        await workflowStatusRepository.create(project.id, workflowStatus, client);
      }

      return { ...project, project_role: 'admin' };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'PROJECT_CONFLICT', 'Project key or default configuration already exists');
    }
    throw error;
  }
}

async function getProject(projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }
  return project;
}

async function updateProject(projectId, changes) {
  const project = await projectRepository.update(projectId, changes);
  if (!project) {
    throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }
  return project;
}

async function deleteProject(projectId) {
  if (!await projectRepository.remove(projectId)) {
    throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }
}

module.exports = {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
};
