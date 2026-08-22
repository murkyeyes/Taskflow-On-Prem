const express = require('express');

const issueTypeController = require('../controllers/issueType.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.get('/:projectId/issue-types', requireAuth, requireRole(['admin', 'member', 'viewer']), issueTypeController.list);
router.post('/:projectId/issue-types', requireAuth, requireRole(['admin']), issueTypeController.create);
router.patch('/:projectId/issue-types/:id', requireAuth, requireRole(['admin']), issueTypeController.update);
router.delete('/:projectId/issue-types/:id', requireAuth, requireRole(['admin']), issueTypeController.remove);

module.exports = router;
