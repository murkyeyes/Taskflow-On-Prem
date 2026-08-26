const express = require('express');

const attachmentController = require('../controllers/attachment.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const issueAttachmentRouter = express.Router();
issueAttachmentRouter.get('/:issueKey/attachments', requireAuth, requireRole(['admin', 'member', 'viewer']), attachmentController.list);
issueAttachmentRouter.post('/:issueKey/attachments', requireAuth, requireRole(['admin', 'member']), attachmentController.createLink);

const attachmentRouter = express.Router();
attachmentRouter.get('/:id/download', requireAuth, attachmentController.download);
attachmentRouter.delete('/:id', requireAuth, attachmentController.remove);

module.exports = { attachmentRouter, issueAttachmentRouter };
