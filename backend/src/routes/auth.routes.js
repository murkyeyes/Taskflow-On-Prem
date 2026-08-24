const express = require('express');

const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireAccountAdmin, requireOverallAdmin } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.post('/register', requireAuth, requireAccountAdmin, authController.register);
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);
router.get('/users', requireAuth, requireAccountAdmin, authController.listUsers);
router.patch('/users/:userId/role', requireAuth, requireOverallAdmin, authController.changeRole);
router.delete('/users/:userId', requireAuth, requireAccountAdmin, authController.deactivate);

module.exports = router;
