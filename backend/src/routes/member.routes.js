const express = require('express');

const memberController = require('../controllers/member.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.get('/:projectId/members', requireAuth, requireRole(['admin', 'member']), memberController.list);
router.post('/:projectId/members', requireAuth, requireRole(['admin']), memberController.create);
router.patch('/:projectId/members/:userId', requireAuth, requireRole(['admin']), memberController.update);
router.delete('/:projectId/members/:userId', requireAuth, requireRole(['admin']), memberController.remove);

module.exports = router;
