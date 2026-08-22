const express = require('express');

const issueController = require('../controllers/issue.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');
const workspaceController = require('../controllers/workspace.controller');

const projectIssueRouter = express.Router();
projectIssueRouter.get('/:projectId/issues', requireAuth, requireRole(['admin', 'member', 'viewer']), issueController.list);
projectIssueRouter.post('/:projectId/issues', requireAuth, requireRole(['admin', 'member']), issueController.create);

const issueRouter = express.Router();
issueRouter.get('/:issueKey', requireAuth, requireRole(['admin', 'member', 'viewer']), issueController.get);
issueRouter.patch('/:issueKey/status', requireAuth, requireRole(['admin', 'member']), issueController.changeStatus);
issueRouter.patch('/:issueKey/planning', requireAuth, requireRole(['admin', 'member']), workspaceController.updatePlanning);
issueRouter.patch('/:issueKey', requireAuth, requireRole(['admin', 'member']), issueController.update);
issueRouter.delete('/:issueKey', requireAuth, requireRole(['admin']), issueController.remove);

module.exports = {
  issueRouter,
  projectIssueRouter,
};
