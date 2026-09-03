const express = require('express');

const projectController = require('../controllers/project.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireAccountAdmin, requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.get('/', requireAuth, projectController.list);
router.post('/', requireAuth, requireAccountAdmin, projectController.create);
router.get('/:projectId', requireAuth, requireRole(['admin', 'member', 'viewer']), projectController.get);
router.patch('/:projectId', requireAuth, requireRole(['admin']), projectController.update);
router.delete('/:projectId', requireAuth, requireAccountAdmin, projectController.remove);

module.exports = router;
