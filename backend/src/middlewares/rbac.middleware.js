const memberRepository = require('../repositories/member.repository');
const HttpError = require('../utils/httpError');
const { requireInteger, requireString } = require('../utils/validation');

const knownRoles = new Set(['admin', 'member', 'viewer']);

function requireRole(allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0 || allowedRoles.some((role) => !knownRoles.has(role))) {
    throw new Error('requireRole must receive one or more valid project roles');
  }

  return async function roleMiddleware(request, response, next) {
    try {
      let membership;
      if (request.params.projectId !== undefined) {
        const projectId = requireInteger(request.params.projectId, 'projectId', { min: 1 });
        membership = await memberRepository.findEffectiveRoleByProjectId(projectId, request.user.userId);
      } else if (request.params.issueKey !== undefined) {
        const issueKey = requireString(request.params.issueKey, 'issueKey', { min: 3, max: 20 });
        membership = await memberRepository.findEffectiveRoleByIssueKey(issueKey, request.user.userId);
      } else {
        throw new HttpError(500, 'RBAC_CONTEXT_MISSING', 'Project authorization context is missing');
      }

      if (!membership || !allowedRoles.includes(membership.project_role)) {
        throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
      }

      request.projectId = membership.project_id;
      request.projectRole = membership.project_role;
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function requireAccountAdmin(request, response, next) {
  try {
    if (!await memberRepository.hasAnyAdminMembership(request.user.userId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Only project administrators can create accounts');
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireRole,
  requireAccountAdmin,
};
