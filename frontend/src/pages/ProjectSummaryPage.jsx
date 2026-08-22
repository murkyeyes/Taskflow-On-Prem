import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getSummary } from '../api/workspace.api';

export default function ProjectSummaryPage() {
  const { project } = useOutletContext(); const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { getSummary(project.id).then(setData).catch((e) => setError(e.message)); }, [project.id]);
  if (!data) return <p className="muted">{error || 'Loading summary…'}</p>;
  const total = Math.max(data.metrics.total, 1);
  return <div className="dashboard-page">
    <div className="info-banner"><span>ⓘ</span><div><strong>Your project at a glance</strong><p>Live reporting from issues, priorities, workload, and recent workflow activity.</p></div></div>
    <div className="metric-grid">
      {[['✓', data.metrics.completed, 'completed', 'in the last 7 days'], ['⌁', data.metrics.updated, 'updated', 'in the last 7 days'], ['▣', data.metrics.created, 'created', 'in the last 7 days'], ['▤', data.metrics.due_soon, 'due soon', 'in the next 7 days']].map(([icon, value, label, sub]) => <div className="metric-card" key={label}><span>{icon}</span><div><strong>{value} {label}</strong><small>{sub}</small></div></div>)}
    </div>
    <div className="dashboard-grid">
      <section className="jira-card"><h2>Status overview</h2><p className="muted">A snapshot of your work items. <Link to={`/projects/${project.id}/board`}>View board</Link></p><div className="status-chart"><div className="donut" style={{ '--complete': `${Math.round((data.metrics.completed / total) * 100)}%` }}><span><strong>{data.metrics.total}</strong>Total issues</span></div><ul>{data.statuses.map((item) => <li key={item.id}><i style={{ background: item.is_final ? '#36b37e' : '#579dff' }} />{item.name}<b>{item.count}</b></li>)}</ul></div></section>
      <section className="jira-card"><h2>Recent activity</h2><p className="muted">What is happening across the project.</p><div className="activity-list">{data.activity.map((item, index) => <div key={`${item.issue_key}-${index}`}><span className="avatar-mini">{item.actor.slice(0, 1)}</span><p><strong>{item.actor}</strong> {item.action}<br/><Link to={`/issues/${item.issue_key}`}>{item.issue_key}: {item.title}</Link><small>{new Date(item.occurred_at).toLocaleString()}</small></p></div>)}{!data.activity.length && <p className="muted">No activity yet.</p>}</div></section>
      <section className="jira-card"><h2>Priority breakdown</h2><div className="bar-chart">{data.priorities.map((item) => <div key={item.priority}><span>{item.priority}</span><i><b style={{ width: `${(item.count / total) * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div></section>
      <section className="jira-card"><h2>Types of work</h2><div className="bar-chart">{data.types.map((item) => <div key={item.id}><span>{item.name}</span><i><b style={{ width: `${(item.count / total) * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div></section>
      <section className="jira-card"><h2>Team workload</h2><div className="bar-chart">{data.workload.map((item) => <div key={item.user_id}><span>{item.name}</span><i><b style={{ width: `${(item.count / total) * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div></section>
      <section className="jira-card empty-epic"><span className="epic-symbol">▦</span><h2>Epic progress</h2><p className="muted">Use issue types and story points to track larger initiatives.</p></section>
    </div>
  </div>;
}
