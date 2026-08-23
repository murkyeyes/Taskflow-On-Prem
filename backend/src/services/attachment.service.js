const attachmentRepository = require('../repositories/attachment.repository');
const issueRepository = require('../repositories/issue.repository');
const memberRepository = require('../repositories/member.repository');
const workflowStatusRepository = require('../repositories/workflowStatus.repository');
const HttpError = require('../utils/httpError');
const { validateFile } = require('../utils/attachmentFile.util');
const withTransaction = require('../utils/withTransaction');

async function listAttachments(issueKey) {
  return attachmentRepository.listByIssueKey(issueKey);
}

async function uploadAttachment(issueKey, actorId, projectRole, upload) {
  return withTransaction(async (client) => {
    const issue = await issueRepository.lockByKey(issueKey, client);
    if (!issue) throw new HttpError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const status = await workflowStatusRepository.findById(issue.project_id, issue.status_id, client);
    if (status?.is_final && projectRole !== 'admin') throw new HttpError(403, 'COMPLETED_ISSUE_LOCKED', 'Only an Admin can change report files on a completed issue');
    const validated = validateFile(upload.fileName, upload.mediaType, upload.fileData);
    const attachment = await attachmentRepository.create({
      issueId: issue.id,
      uploadedBy: actorId,
      fileName: validated.fileName,
      mediaType: validated.mediaType,
      fileSize: upload.fileData.length,
      fileData: upload.fileData,
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
  return (await requireAccessibleAttachment(id, actorId, true)).attachment;
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

module.exports = { deleteAttachment, downloadAttachment, listAttachments, uploadAttachment };
