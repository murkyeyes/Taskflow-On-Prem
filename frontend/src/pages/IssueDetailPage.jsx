import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as attachmentApi from '../api/attachment.api';
import * as issueApi from '../api/issue.api';
import * as projectApi from '../api/project.api';
import ReportFiles from '../components/issue/ReportFiles';
import IssueForm from '../components/issue/IssueForm';
import useAuth from '../hooks/useAuth';
import usePolling from '../hooks/usePolling';
import { getProjectUpdates } from '../api/update.api';

export default function IssueDetailPage() {
  const { issueKey } = useParams();
  const { user } = useAuth();
  const [issue, setIssue] = useState(null); const [types, setTypes] = useState([]); const [assignees, setAssignees] = useState([]); const [attachments, setAttachments] = useState([]); const [role, setRole] = useState('viewer'); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async () => { try { const issueResult = await issueApi.getIssue(issueKey); const [attachmentResult, typeResult, assigneeResult, projects] = await Promise.all([attachmentApi.listAttachments(issueKey), projectApi.listIssueTypes(issueResult.issue.project_id), projectApi.listAssignees(issueResult.issue.project_id), projectApi.listProjects()]); setIssue(issueResult.issue); setAttachments(attachmentResult.attachments); setTypes(typeResult.issueTypes); setAssignees(assigneeResult.assignees); setRole(projects.projects.find((project) => project.id === issueResult.issue.project_id)?.project_role ?? 'viewer'); } catch (requestError) { setError(requestError.message); } }, [issueKey]);
  useEffect(() => { load(); }, [load]);
  const mergeUpdates = useCallback((updates) => { setIssue((current) => updates.issues.find((item) => item.id === current?.id) ?? current); }, []);
  usePolling({ enabled: Boolean(issue), fetchUpdates: (since) => getProjectUpdates(issue.project_id, since), onUpdates: mergeUpdates });
  if (!issue) return <div className="panel"><p>{error || 'Loading issue…'}</p></div>;
  const completed = Boolean(issue.completed_at);
  const canEdit = role === 'admin' || (role === 'member' && !completed);
  async function edit(data) { setError(''); setMessage(''); try { await issueApi.updateIssue(issueKey, data); await load(); setMessage('Issue saved successfully.'); } catch (requestError) { setError(requestError.message); } }
  async function addReportLink(data) { setError(''); setMessage(''); try { await attachmentApi.createAttachmentLink(issueKey, data); await load(); setMessage('Report link added.'); return true; } catch (requestError) { setError(requestError.message); return false; } }
  async function download(attachment) { setError(''); try { await attachmentApi.downloadAttachment(attachment); } catch (requestError) { setError(requestError.message); } }
  async function removeAttachment(id) { setError(''); setMessage(''); try { await attachmentApi.deleteAttachment(id); await load(); setMessage('Report removed.'); } catch (requestError) { setError(requestError.message); } }
  const canMutateReports = role === 'admin' || (role === 'member' && !completed);
  return <div className="detail-grid"><section className="panel"><Link className="back-link" to={`/projects/${issue.project_id}/board`}>← Back to board</Link>{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}<p className="eyebrow">{issue.issue_key} · {role}</p><h1>{issue.title}</h1><p className="issue-detail-assignee">👤 {issue.assignee_name || 'Unassigned'}</p><p className="issue-description">{issue.description || 'No description.'}</p><div className="issue-summary"><span className={`priority priority-${issue.priority}`}>{issue.priority}</span><span>Type #{issue.issue_type_id}</span><span>Status #{issue.status_id}</span><span>Created {new Date(issue.created_at).toLocaleString()}</span>{issue.completed_at && <span>Completed {new Date(issue.completed_at).toLocaleString()}</span>}</div>{completed && role !== 'admin' && <p className="alert completed-lock">This task is completed. Only an Admin can edit its fields or status.</p>}{canEdit && <><h2>Edit issue</h2><IssueForm issueTypes={types} assignees={assignees} initialIssue={issue} restrictAssigneeToUserId={role === 'admin' ? null : user.id} onSubmit={edit} /></>}</section><section className="panel"><ReportFiles attachments={attachments} canMutate={canMutateReports} locked={completed && role !== 'admin'} onAddLink={addReportLink} onDownload={download} onDelete={removeAttachment} /></section></div>;
}
