import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import * as issueApi from '../api/issue.api';
import * as workspaceApi from '../api/workspace.api';

export default function ProjectBacklogPage() {
  const { project, role } = useOutletContext(); const canEdit = role !== 'viewer';
  const [issues, setIssues] = useState([]); const [sprints, setSprints] = useState([]); const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', goal: '', status: 'planned', startDate: '', endDate: '' });
  const load = useCallback(async () => { try { const [issueResult, sprintResult] = await Promise.all([issueApi.listIssues(project.id, { pageSize: 100 }), workspaceApi.listSprints(project.id)]); setIssues(issueResult.issues); setSprints(sprintResult.sprints); } catch (e) { setError(e.message); } }, [project.id]);
  useEffect(() => { load(); }, [load]);
  async function create(event) { event.preventDefault(); try { await workspaceApi.createSprint(project.id, { ...form, startDate: form.startDate || null, endDate: form.endDate || null }); setForm({ name: '', goal: '', status: 'planned', startDate: '', endDate: '' }); await load(); } catch (e) { setError(e.message); } }
  async function plan(issue, changes) { try { await workspaceApi.updatePlanning(issue.issue_key, changes); await load(); } catch (e) { setError(e.message); } }
  const buckets = [{ id: null, name: 'Backlog', status: 'backlog' }, ...sprints];
  return <div><div className="view-heading"><div><h2>Backlog</h2><p>Plan work, assign sprints, estimates, and due dates.</p></div></div>{error && <p className="alert error">{error}</p>}
    {canEdit && <form className="toolbar-form jira-card" onSubmit={create}><input required placeholder="Sprint name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/><input placeholder="Goal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}/><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}/><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}/><button className="button primary">Create sprint</button></form>}
    <div className="backlog-groups">{buckets.map((bucket) => <section className="backlog-group" key={bucket.id ?? 'backlog'}><header><div><strong>{bucket.name}</strong><span className={`status-lozenge ${bucket.status}`}>{bucket.status}</span></div><span>{issues.filter((i) => (i.sprint_id ?? null) === bucket.id).length} issues</span></header>
      {issues.filter((issue) => (issue.sprint_id ?? null) === bucket.id).map((issue) => { const issueEditable = canEdit && (role === 'admin' || !issue.completed_at); return <div className="backlog-row" key={issue.id}><span className="issue-type-icon">✓</span><Link to={`/issues/${issue.issue_key}`}><b>{issue.issue_key}</b> {issue.title}</Link><select aria-label={`Sprint for ${issue.issue_key}`} disabled={!issueEditable} value={issue.sprint_id ?? ''} onChange={(e) => plan(issue, { sprintId: e.target.value ? Number(e.target.value) : null })}><option value="">Backlog</option>{sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><input aria-label={`Story points for ${issue.issue_key}`} disabled={!issueEditable} type="number" min="0" max="100" placeholder="Pts" value={issue.story_points ?? ''} onChange={(e) => plan(issue, { storyPoints: e.target.value === '' ? null : Number(e.target.value) })}/><input aria-label={`Due date for ${issue.issue_key}`} disabled={!issueEditable} type="date" value={issue.due_date?.slice(0, 10) ?? ''} onChange={(e) => plan(issue, { dueDate: e.target.value || null })}/></div>; })}
      {!issues.some((i) => (i.sprint_id ?? null) === bucket.id) && <p className="empty-row">No issues here.</p>}</section>)}</div>
  </div>;
}
