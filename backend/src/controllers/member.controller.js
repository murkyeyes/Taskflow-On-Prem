const memberService = require('../services/member.service');
const HttpError = require('../utils/httpError');
const {
  optionalString,
  requireEnum,
  requireInteger,
  requireObject,
} = require('../utils/validation');

const roles = ['admin', 'member', 'viewer'];

async function list(request, response) {
  response.json({ members: await memberService.listMembers(request.projectId) });
}

async function assignees(request, response) {
  const rawSearch = request.query.search;
  const search = rawSearch === undefined || rawSearch === ''
    ? ''
    : optionalString(rawSearch, 'search', { min: 1, max: 120 });
  response.json({ assignees: await memberService.searchAssignees(request.projectId, search) });
}

async function create(request, response) {
  const body = requireObject(request.body);
  const projectRole = requireEnum(body.projectRole, 'projectRole', roles);
  if (projectRole !== 'viewer') throw new HttpError(400, 'VIEWER_ONLY_ASSIGNMENT', 'New Space assignments must use viewer role');
  const member = await memberService.addMember(
    request.projectId,
    requireInteger(body.userId, 'userId', { min: 1 }),
    projectRole,
  );
  response.status(201).json({ member });
}

async function update(request, response) {
  const body = requireObject(request.body);
  const projectRole = requireEnum(body.projectRole, 'projectRole', roles);
  if (projectRole !== 'viewer') throw new HttpError(400, 'VIEWER_ONLY_ASSIGNMENT', 'Space assignments must remain viewer-only');
  const member = await memberService.updateMember(
    request.projectId,
    requireInteger(request.params.userId, 'userId', { min: 1 }),
    projectRole,
  );
  response.json({ member });
}

async function remove(request, response) {
  await memberService.removeMember(
    request.projectId,
    requireInteger(request.params.userId, 'userId', { min: 1 }),
  );
  response.status(204).send();
}

module.exports = {
  create,
  assignees,
  list,
  remove,
  update,
};
