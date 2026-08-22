const updateRepository = require('../repositories/update.repository');

const DEFAULT_POLL_INTERVAL_MS = 7000;

async function getUpdatesSince(projectId, since) {
  const serverTime = await updateRepository.getServerTime();
  const [issues, comments] = await Promise.all([
    updateRepository.findChangedIssues(projectId, since, serverTime),
    updateRepository.findNewComments(projectId, since, serverTime),
  ]);
  return {
    issues,
    comments,
    serverTime: serverTime.toISOString(),
  };
}

module.exports = {
  DEFAULT_POLL_INTERVAL_MS,
  getUpdatesSince,
};
