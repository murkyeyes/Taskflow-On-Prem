const express = require('express');

const workflowStatusController = require('../controllers/workflowStatus.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.get('/:projectId/workflow-statuses', requireAuth, requireRole(['admin', 'member', 'viewer']), workflowStatusController.list);
router.post('/:projectId/workflow-statuses', requireAuth, requireRole(['admin']), workflowStatusController.create);
router.patch('/:projectId/workflow-statuses/reorder', requireAuth, requireRole(['admin']), workflowStatusController.reorder);
router.patch('/:projectId/workflow-statuses/:id', requireAuth, requireRole(['admin']), workflowStatusController.update);
router.delete('/:projectId/workflow-statuses/:id', requireAuth, requireRole(['admin']), workflowStatusController.remove);

module.exports = router;
