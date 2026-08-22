const express = require('express');

const commentController = require('../controllers/comment.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const issueCommentRouter = express.Router();
issueCommentRouter.get('/:issueKey/comments', requireAuth, requireRole(['admin', 'member', 'viewer']), commentController.list);
issueCommentRouter.post('/:issueKey/comments', requireAuth, requireRole(['admin', 'member']), commentController.create);

const commentRouter = express.Router();
commentRouter.patch('/:id', requireAuth, commentController.update);
commentRouter.delete('/:id', requireAuth, commentController.remove);

module.exports = {
  commentRouter,
  issueCommentRouter,
};
