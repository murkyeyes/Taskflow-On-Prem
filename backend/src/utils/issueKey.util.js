function formatIssueKey(projectKey, number) {
  return `${projectKey}-${number}`;
}

module.exports = formatIssueKey;
