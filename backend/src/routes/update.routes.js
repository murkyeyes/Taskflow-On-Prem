const express = require('express');

const updateController = require('../controllers/update.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.get('/:projectId/updates', requireAuth, requireRole(['admin', 'member', 'viewer']), updateController.getUpdates);

module.exports = router;
