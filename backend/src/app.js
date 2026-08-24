const cookieParser = require('cookie-parser');
const express = require('express');

if (process.env.PROTECTED_RUNTIME === '1') require('bytenode');

const {
  errorHandler,
  notFoundHandler,
} = require('./middlewares/errorHandler.middleware');
const authRoutes = require('./routes/auth.routes');
const { attachmentRouter, issueAttachmentRouter } = require('./routes/attachment.routes');
const { commentRouter, issueCommentRouter } = require('./routes/comment.routes');
const { issueRouter, projectIssueRouter } = require('./routes/issue.routes');
const issueTypeRoutes = require('./routes/issueType.routes');
const memberRoutes = require('./routes/member.routes');
const projectRoutes = require('./routes/project.routes');
const workflowStatusRoutes = require('./routes/workflowStatus.routes');
const updateRoutes = require('./routes/update.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (request, response) => response.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/projects', memberRoutes);
app.use('/api/projects', issueTypeRoutes);
app.use('/api/projects', workflowStatusRoutes);
app.use('/api/projects', projectIssueRouter);
app.use('/api/projects', updateRoutes);
app.use('/api/projects', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/issues', issueCommentRouter);
app.use('/api/issues', issueAttachmentRouter);
app.use('/api/issues', issueRouter);
app.use('/api/comments', commentRouter);
app.use('/api/attachments', attachmentRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
