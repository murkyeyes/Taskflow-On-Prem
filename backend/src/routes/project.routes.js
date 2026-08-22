const express = require('express');

const projectController = require('../controllers/project.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.get('/', requireAuth, projectController.list);
router.post('/', requireAuth, projectController.create);
router.get('/:projectId', requireAuth, requireRole(['admin', 'member', 'viewer']), projectController.get);
router.patch('/:projectId', requireAuth, requireRole(['admin']), projectController.update);
router.delete('/:projectId', requireAuth, requireRole(['admin']), projectController.remove);

module.exports = router;
