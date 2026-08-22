const workspaceService = require('../services/workspace.service');
const HttpError = require('../utils/httpError');
const { optionalBoolean, optionalInteger, optionalString, requireEnum, requireInteger, requireObject, requireString } = require('../utils/validation');

const sprintStatuses = ['planned', 'active', 'completed'];
const linkTypes = ['branch', 'commit', 'pull_request', 'build', 'deployment'];

function nullableString(value, field, max) {
  if (value === null) return null;
  return optionalString(value, field, { min: 1, max });
}

function nullableDate(value, field) {
  if (value === undefined || value === null || value === '') return value === undefined ? undefined : null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a valid YYYY-MM-DD date`);
  }
  return value;
}

function validateDates(data) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'endDate cannot be before startDate');
  }
}

function sprintBody(body, partial = false) {
  const source = requireObject(body);
  const data = {};
  if (!partial || source.name !== undefined) data.name = requireString(source.name, 'name', { min: 1, max: 160 });
  if (!partial || source.goal !== undefined) data.goal = nullableString(source.goal, 'goal', 10_000);
  if (!partial || source.status !== undefined) data.status = source.status === undefined ? 'planned' : requireEnum(source.status, 'status', sprintStatuses);
  if (!partial || source.startDate !== undefined) data.startDate = nullableDate(source.startDate, 'startDate') ?? null;
  if (!partial || source.endDate !== undefined) data.endDate = nullableDate(source.endDate, 'endDate') ?? null;
  if (partial && Object.keys(data).length === 0) throw new HttpError(400, 'VALIDATION_ERROR', 'At least one sprint field must be provided');
  validateDates(data);
  return data;
}

async function summary(req, res) { res.json(await workspaceService.getSummary(req.projectId)); }
async function listSprints(req, res) { res.json({ sprints: await workspaceService.listSprints(req.projectId) }); }
async function createSprint(req, res) { res.status(201).json({ sprint: await workspaceService.createSprint(req.projectId, sprintBody(req.body), req.user.userId) }); }
async function updateSprint(req, res) { res.json({ sprint: await workspaceService.updateSprint(req.projectId, requireInteger(req.params.sprintId, 'sprintId', { min: 1 }), sprintBody(req.body, true), req.user.userId) }); }
async function deleteSprint(req, res) { await workspaceService.deleteSprint(req.projectId, requireInteger(req.params.sprintId, 'sprintId', { min: 1 })); res.status(204).send(); }

async function updatePlanning(req, res) {
  const body = requireObject(req.body); const data = {};
  if (body.sprintId !== undefined) data.sprintId = optionalInteger(body.sprintId, 'sprintId', { min: 1 });
  if (body.dueDate !== undefined) data.dueDate = nullableDate(body.dueDate, 'dueDate') ?? null;
  if (body.storyPoints !== undefined) data.storyPoints = optionalInteger(body.storyPoints, 'storyPoints', { min: 0, max: 100 });
  if (body.backlogRank !== undefined) data.backlogRank = requireInteger(body.backlogRank, 'backlogRank', { min: 0 });
  if (Object.keys(data).length === 0) throw new HttpError(400, 'VALIDATION_ERROR', 'At least one planning field must be provided');
  res.json({ issue: await workspaceService.updatePlanning(req.params.issueKey, req.projectId, data) });
}

async function listDevelopment(req, res) { res.json({ developmentLinks: await workspaceService.listDevelopmentLinks(req.projectId) }); }
async function createDevelopment(req, res) {
  const body = requireObject(req.body);
  let url; try { url = new URL(requireString(body.url, 'url', { min: 8, max: 2000 })).toString(); } catch { throw new HttpError(400, 'VALIDATION_ERROR', 'url must be a valid absolute URL'); }
  const link = await workspaceService.createDevelopmentLink(req.projectId, {
    issueKey: nullableString(body.issueKey, 'issueKey', 20), provider: body.provider === undefined ? 'Other' : requireString(body.provider, 'provider', { max: 80 }),
    linkType: requireEnum(body.linkType, 'linkType', linkTypes), title: requireString(body.title, 'title', { max: 240 }), url,
    status: nullableString(body.status, 'status', 40),
  }, req.user.userId);
  res.status(201).json({ developmentLink: link });
}
async function deleteDevelopment(req, res) { await workspaceService.deleteDevelopmentLink(req.projectId, requireInteger(req.params.linkId, 'linkId', { min: 1 })); res.status(204).send(); }

async function listDocs(req, res) { res.json({ docs: await workspaceService.listDocs(req.projectId) }); }
async function getDoc(req, res) { res.json({ doc: await workspaceService.getDoc(req.projectId, requireInteger(req.params.docId, 'docId', { min: 1 })) }); }
async function createDoc(req, res) { const body = requireObject(req.body); res.status(201).json({ doc: await workspaceService.createDoc(req.projectId, { title: requireString(body.title, 'title', { max: 200 }), content: typeof body.content === 'string' ? body.content : '' }, req.user.userId) }); }
async function updateDoc(req, res) { const body = requireObject(req.body); const data = {}; if (body.title !== undefined) data.title = requireString(body.title, 'title', { max: 200 }); if (body.content !== undefined) data.content = requireString(body.content, 'content', { min: 0, max: 200_000 }); if (!Object.keys(data).length) throw new HttpError(400, 'VALIDATION_ERROR', 'At least one document field must be provided'); res.json({ doc: await workspaceService.updateDoc(req.projectId, requireInteger(req.params.docId, 'docId', { min: 1 }), data, req.user.userId) }); }
async function deleteDoc(req, res) { await workspaceService.deleteDoc(req.projectId, requireInteger(req.params.docId, 'docId', { min: 1 })); res.status(204).send(); }

function formBody(body, partial = false) {
  const source = requireObject(body); const data = {};
  if (!partial || source.name !== undefined) data.name = requireString(source.name, 'name', { max: 200 });
  if (!partial || source.description !== undefined) data.description = source.description === undefined ? '' : requireString(source.description, 'description', { min: 0, max: 10_000 });
  if (!partial || source.fields !== undefined) { if (!Array.isArray(source.fields) || source.fields.length > 50) throw new HttpError(400, 'VALIDATION_ERROR', 'fields must be an array with at most 50 items'); data.fields = source.fields; }
  if (!partial || source.isActive !== undefined) data.isActive = optionalBoolean(source.isActive, 'isActive', true);
  if (partial && !Object.keys(data).length) throw new HttpError(400, 'VALIDATION_ERROR', 'At least one form field must be provided');
  return data;
}
async function listForms(req, res) { res.json({ forms: await workspaceService.listForms(req.projectId) }); }
async function getForm(req, res) { res.json({ form: await workspaceService.getForm(req.projectId, requireInteger(req.params.formId, 'formId', { min: 1 })) }); }
async function createForm(req, res) { res.status(201).json({ form: await workspaceService.createForm(req.projectId, formBody(req.body), req.user.userId) }); }
async function updateForm(req, res) { res.json({ form: await workspaceService.updateForm(req.projectId, requireInteger(req.params.formId, 'formId', { min: 1 }), formBody(req.body, true)) }); }
async function deleteForm(req, res) { await workspaceService.deleteForm(req.projectId, requireInteger(req.params.formId, 'formId', { min: 1 })); res.status(204).send(); }
async function submitForm(req, res) { const body = requireObject(req.body); const answers = requireObject(body.answers, 'answers'); res.status(201).json({ submission: await workspaceService.submitForm(req.projectId, requireInteger(req.params.formId, 'formId', { min: 1 }), answers, req.user.userId) }); }
async function listSubmissions(req, res) { res.json({ submissions: await workspaceService.listSubmissions(req.projectId, requireInteger(req.params.formId, 'formId', { min: 1 })) }); }

module.exports = { createDevelopment, createDoc, createForm, createSprint, deleteDevelopment, deleteDoc, deleteForm, deleteSprint, getDoc, getForm, listDevelopment, listDocs, listForms, listSprints, listSubmissions, submitForm, summary, updateDoc, updateForm, updatePlanning, updateSprint };
