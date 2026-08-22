import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import * as issueApi from '../api/issue.api';
import { updatePlanning } from '../api/workspace.api';

export default function ProjectTimelinePage() {
  const { project, role } = useOutletContext(); const [issues, setIssues] = useState([]); const [error, setError] = useState('');
  const load = useCallback(() => issueApi.listIssues(project.id, { pageSize: 100 }).then((r) => setIssues(r.issues)).catch((e) => setError(e.message)), [project.id]); useEffect(() => { load(); }, [load]);
  const dated = useMemo(() => [...issues].sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')), [issues]);
  async function save(issueKey, dueDate) { try { await updatePlanning(issueKey, { dueDate: dueDate || null }); await load(); } catch (e) { setError(e.message); } }
  return <div><div className="view-heading"><div><h2>Timeline</h2><p>Schedule delivery dates across project work.</p></div></div>{error && <p className="alert error">{error}</p>}<section className="jira-card timeline"><div className="timeline-head"><span>Work item</span><span>Due date</span><span>Schedule</span></div>{dated.map((issue, index) => <div className="timeline-row" key={issue.id}><Link to={`/issues/${issue.issue_key}`}><b>{issue.issue_key}</b><small>{issue.title}</small></Link><input disabled={role === 'viewer' || (role !== 'admin' && issue.completed_at)} type="date" value={issue.due_date?.slice(0, 10) ?? ''} onChange={(e) => save(issue.issue_key, e.target.value)}/><div className="timeline-track"><i style={{ left: `${(index * 13) % 65}%`, width: `${22 + (index % 4) * 7}%` }}/></div></div>)}</section></div>;
}
