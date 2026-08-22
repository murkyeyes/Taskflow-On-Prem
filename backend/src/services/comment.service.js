const commentRepository = require('../repositories/comment.repository');
const issueRepository = require('../repositories/issue.repository');
const HttpError = require('../utils/httpError');
const withTransaction = require('../utils/withTransaction');

async function listComments(issueKey) {
  return commentRepository.listByIssueKey(issueKey);
}

async function createComment(issueKey, userId, content) {
  return withTransaction(async (client) => {
    const issue = await issueRepository.findByKey(issueKey, client);
    if (!issue) {
      throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    }
    const comment = await commentRepository.create(issue.id, userId, content, client);
    await issueRepository.touch(issue.id, client);
    return comment;
  });
}

async function updateComment(id, userId, content) {
  return withTransaction(async (client) => {
    const comment = await commentRepository.findForAuthorization(id, userId, client);
    if (!comment) {
      throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }
    if (comment.user_id !== userId || !['admin', 'member'].includes(comment.project_role)) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the comment author with member access can edit this comment');
    }
    const updated = await commentRepository.update(id, content, client);
    await issueRepository.touch(comment.issue_id, client);
    return updated;
  });
}

async function deleteComment(id, userId) {
  return withTransaction(async (client) => {
    const comment = await commentRepository.findForAuthorization(id, userId, client);
    if (!comment) {
      throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }
    const isAdmin = comment.project_role === 'admin';
    const isMemberAuthor = comment.user_id === userId && comment.project_role === 'member';
    if (!isAdmin && !isMemberAuthor) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the comment author or a project admin can delete this comment');
    }
    await commentRepository.remove(id, client);
    await issueRepository.touch(comment.issue_id, client);
  });
}

module.exports = {
  createComment,
  deleteComment,
  listComments,
  updateComment,
};
