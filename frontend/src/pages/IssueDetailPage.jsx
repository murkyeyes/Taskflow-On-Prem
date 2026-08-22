import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as commentApi from '../api/comment.api';
import * as issueApi from '../api/issue.api';
import * as projectApi from '../api/project.api';
import CommentList from '../components/issue/CommentList';
import IssueForm from '../components/issue/IssueForm';
import RoleGuard from '../components/common/RoleGuard';
import useAuth from '../hooks/useAuth';
import usePolling from '../hooks/usePolling';
import { getProjectUpdates } from '../api/update.api';

export default function IssueDetailPage() {
  const { issueKey } = useParams();
  const { user } = useAuth();
  const [issue, setIssue] = useState(null); const [types, setTypes] = useState([]); const [comments, setComments] = useState([]); const [role, setRole] = useState('viewer'); const [error, setError] = useState('');
  const load = useCallback(async () => { try { const issueResult = await issueApi.getIssue(issueKey); const [commentResult, typeResult, projects] = await Promise.all([commentApi.listComments(issueKey), projectApi.listIssueTypes(issueResult.issue.project_id), projectApi.listProjects()]); setIssue(issueResult.issue); setComments(commentResult.comments); setTypes(typeResult.issueTypes); setRole(projects.projects.find((project) => project.id === issueResult.issue.project_id)?.project_role ?? 'viewer'); } catch (requestError) { setError(requestError.message); } }, [issueKey]);
  useEffect(() => { load(); }, [load]);
  const mergeUpdates = useCallback((updates) => { setIssue((current) => updates.issues.find((item) => item.id === current?.id) ?? current); setComments((current) => { const map = new Map(current.map((comment) => [comment.id, comment])); updates.comments.forEach((comment) => map.set(comment.id, comment)); return [...map.values()]; }); }, []);
  usePolling({ enabled: Boolean(issue), fetchUpdates: (since) => getProjectUpdates(issue.project_id, since), onUpdates: mergeUpdates });
  if (!issue) return <div className="panel"><p>{error || 'Loading issue…'}</p></div>;
  const canEdit = ['admin', 'member'].includes(role);
  async function edit(data) { await issueApi.updateIssue(issueKey, data); await load(); }
  async function addComment(content) { await commentApi.createComment(issueKey, content); await load(); }
  async function editComment(id, content) { await commentApi.updateComment(id, content); await load(); }
  async function deleteComment(id) { await commentApi.deleteComment(id); await load(); }
  return <div className="detail-grid"><section className="panel"><Link className="back-link" to={`/projects/${issue.project_id}`}>← Back to board</Link><p className="eyebrow">{issue.issue_key} · {role}</p><h1>{issue.title}</h1><p className="issue-description">{issue.description || 'No description.'}</p><div className="issue-summary"><span className={`priority priority-${issue.priority}`}>{issue.priority}</span><span>Type #{issue.issue_type_id}</span><span>Status #{issue.status_id}</span></div><RoleGuard role={role} allow={['admin', 'member']}><h2>Edit issue</h2><IssueForm issueTypes={types} initialIssue={issue} onSubmit={edit} /></RoleGuard></section><section className="panel"><h2>Comments</h2><CommentList comments={comments} currentUserId={user.id} projectRole={role} onEdit={editComment} onDelete={deleteComment} /><RoleGuard role={role} allow={['admin', 'member']}><form className="comment-form" onSubmit={async (event) => { event.preventDefault(); const content = new FormData(event.currentTarget).get('content'); await addComment(content); event.currentTarget.reset(); }}><textarea name="content" required placeholder="Add a comment…" /><button className="button primary" type="submit">Comment</button></form></RoleGuard></section></div>;
}
