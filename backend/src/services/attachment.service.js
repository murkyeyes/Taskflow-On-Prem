const attachmentRepository = require('../repositories/attachment.repository');
const issueRepository = require('../repositories/issue.repository');
const memberRepository = require('../repositories/member.repository');
const workflowStatusRepository = require('../repositories/workflowStatus.repository');
const HttpError = require('../utils/httpError');
const { validateReportLink } = require('../utils/reportLink.util');
const withTransaction = require('../utils/withTransaction');

async function listAttachments(issueKey) {
  return attachmentRepository.listByIssueKey(issueKey);
}

async function createAttachmentLink(issueKey, actorId, projectRole, input) {
  return withTransaction(async (client) => {
    const issue = await issueRepository.lockByKey(issueKey, client);
    if (!issue) throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const status = await workflowStatusRepository.findById(issue.project_id, issue.status_id, client);
    if (status?.is_final && projectRole !== 'admin') throw new HttpError(403, 'COMPLETED_ISSUE_LOCKED', 'Only an Admin can change report files on a completed issue');
    const validated = validateReportLink(input?.url, input?.title);
    const attachment = await attachmentRepository.createLink({
      issueId: issue.id,
      uploadedBy: actorId,
      fileName: validated.title,
      mediaType: validated.mediaType,
      externalUrl: validated.url,
      provider: validated.provider,
    }, client);
    await issueRepository.touch(issue.id, client);
    return attachment;
  });
}

async function requireAccessibleAttachment(id, actorId, includeData = false, client) {
  const attachment = await attachmentRepository.findById(id, { includeData }, client);
  if (!attachment) throw new HttpError(404, 'ATTACHMENT_NOT_FOUND', 'Report file not found');
  const membership = await memberRepository.findEffectiveRoleByProjectId(attachment.project_id, actorId, client);
  if (!membership) throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to access this report file');
  return { attachment, projectRole: membership.project_role };
}

async function downloadAttachment(id, actorId) {
  const attachment = (await requireAccessibleAttachment(id, actorId, true)).attachment;
  if (attachment.external_url) throw new HttpError(409, 'EXTERNAL_REPORT_LINK', 'Open this report using its external URL');
  return attachment;
}

async function deleteAttachment(id, actorId) {
  return withTransaction(async (client) => {
    const { attachment, projectRole } = await requireAccessibleAttachment(id, actorId, false, client);
    const status = await workflowStatusRepository.findById(attachment.project_id, attachment.status_id, client);
    if (status?.is_final && projectRole !== 'admin') throw new HttpError(403, 'COMPLETED_ISSUE_LOCKED', 'Only an Admin can change report files on a completed issue');
    if (projectRole !== 'admin' && (projectRole !== 'member' || attachment.uploaded_by !== actorId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Members may delete only report files they uploaded');
    }
    await attachmentRepository.remove(id, client);
    await issueRepository.touch(attachment.issue_id, client);
  });
}

module.exports = { createAttachmentLink, deleteAttachment, downloadAttachment, listAttachments };
