const issueService = require('../services/issue.service');
const HttpError = require('../utils/httpError');
const {
  optionalInteger,
  optionalString,
  parsePagination,
  requireEnum,
  requireInteger,
  requireObject,
  requireString,
} = require('../utils/validation');

const priorities = ['lowest', 'low', 'medium', 'high', 'highest'];

function optionalDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${fieldName} must be an ISO date (YYYY-MM-DD)`);
  }
  return value;
}

async function list(request, response) {
  const filters = {
    statusId: optionalInteger(request.query.status_id, 'status_id', { min: 1 }),
    assigneeId: optionalInteger(request.query.assignee_id, 'assignee_id', { min: 1 }),
    issueTypeId: optionalInteger(request.query.issue_type_id, 'issue_type_id', { min: 1 }),
    search: optionalString(request.query.search, 'search', { min: 1, max: 120 }),
    createdOn: optionalDate(request.query.created_on, 'created_on'),
    completedOn: optionalDate(request.query.completed_on, 'completed_on'),
  };
  response.json(await issueService.listIssues(request.projectId, filters, parsePagination(request.query)));
}

async function create(request, response) {
  const body = requireObject(request.body);
  const issue = await issueService.createIssue(request.projectId, {
    title: requireString(body.title, 'title', { min: 1, max: 255 }),
    description: optionalString(body.description, 'description', { min: 1, max: 50_000 }),
    issueTypeId: requireInteger(body.issueTypeId, 'issueTypeId', { min: 1 }),
    assigneeId: optionalInteger(body.assigneeId, 'assigneeId', { min: 1 }),
    statusId: optionalInteger(body.statusId, 'statusId', { min: 1 }),
    dueDate: optionalDate(body.dueDate, 'dueDate'),
    priority: body.priority === undefined ? 'medium' : requireEnum(body.priority, 'priority', priorities),
  }, request.user.userId, request.projectRole);
  response.status(201).json({ issue });
}

async function get(request, response) {
  response.json({ issue: await issueService.getIssue(request.params.issueKey) });
}

async function update(request, response) {
  const body = requireObject(request.body);
  const changes = {};
  if (body.title !== undefined) changes.title = requireString(body.title, 'title', { min: 1, max: 255 });
  if (body.description !== undefined) changes.description = optionalString(body.description, 'description', { min: 1, max: 50_000 });
  if (body.assigneeId !== undefined) changes.assigneeId = optionalInteger(body.assigneeId, 'assigneeId', { min: 1 });
  if (body.priority !== undefined) changes.priority = requireEnum(body.priority, 'priority', priorities);
  if (body.issueTypeId !== undefined) changes.issueTypeId = requireInteger(body.issueTypeId, 'issueTypeId', { min: 1 });
  if (body.dueDate !== undefined) changes.dueDate = optionalDate(body.dueDate, 'dueDate');
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'At least one issue field must be provided');
  }
  response.json({ issue: await issueService.updateIssue(request.params.issueKey, changes, request.user.userId, request.projectRole) });
}

async function changeStatus(request, response) {
  const body = requireObject(request.body);
  const issue = await issueService.changeStatus(
    request.params.issueKey,
    requireInteger(body.statusId, 'statusId', { min: 1 }),
    request.user.userId,
    request.projectRole,
  );
  response.json({ issue });
}

async function remove(request, response) {
  await issueService.deleteIssue(request.params.issueKey);
  response.status(204).send();
}

module.exports = {
  changeStatus,
  create,
  get,
  list,
  remove,
  update,
};
