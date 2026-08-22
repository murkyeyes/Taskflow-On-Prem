const express = require('express');
const controller = require('../controllers/workspace.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();
const all = requireRole(['admin', 'member', 'viewer']);
const editors = requireRole(['admin', 'member']);
const admins = requireRole(['admin']);

router.get('/:projectId/summary', requireAuth, all, controller.summary);
router.get('/:projectId/sprints', requireAuth, all, controller.listSprints);
router.post('/:projectId/sprints', requireAuth, editors, controller.createSprint);
router.patch('/:projectId/sprints/:sprintId', requireAuth, editors, controller.updateSprint);
router.post('/:projectId/sprints/:sprintId/complete', requireAuth, editors, controller.completeSprint);
router.delete('/:projectId/sprints/:sprintId', requireAuth, admins, controller.deleteSprint);
router.get('/:projectId/development-links', requireAuth, all, controller.listDevelopment);
router.post('/:projectId/development-links', requireAuth, editors, controller.createDevelopment);
router.delete('/:projectId/development-links/:linkId', requireAuth, editors, controller.deleteDevelopment);
router.get('/:projectId/docs', requireAuth, all, controller.listDocs);
router.post('/:projectId/docs', requireAuth, editors, controller.createDoc);
router.get('/:projectId/docs/:docId', requireAuth, all, controller.getDoc);
router.patch('/:projectId/docs/:docId', requireAuth, editors, controller.updateDoc);
router.delete('/:projectId/docs/:docId', requireAuth, admins, controller.deleteDoc);
router.get('/:projectId/forms', requireAuth, all, controller.listForms);
router.post('/:projectId/forms', requireAuth, admins, controller.createForm);
router.get('/:projectId/forms/:formId', requireAuth, all, controller.getForm);
router.patch('/:projectId/forms/:formId', requireAuth, admins, controller.updateForm);
router.delete('/:projectId/forms/:formId', requireAuth, admins, controller.deleteForm);
router.post('/:projectId/forms/:formId/submissions', requireAuth, all, controller.submitForm);
router.get('/:projectId/forms/:formId/submissions', requireAuth, editors, controller.listSubmissions);

module.exports = router;
