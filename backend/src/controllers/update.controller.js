const updateService = require('../services/update.service');
const HttpError = require('../utils/httpError');
const { requireString } = require('../utils/validation');

async function getUpdates(request, response) {
  const sinceValue = requireString(request.query.since, 'since', { min: 20, max: 40 });
  const since = new Date(sinceValue);
  if (Number.isNaN(since.getTime())) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'since must be a valid ISO timestamp');
  }
  response.json(await updateService.getUpdatesSince(request.projectId, since));
}

module.exports = {
  getUpdates,
};
