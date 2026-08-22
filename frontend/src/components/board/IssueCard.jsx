import { Link } from 'react-router-dom';

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—';

export default function IssueCard({ issue, statuses, canEdit, canEditCompleted, onStatusChange }) {
  const completed = Boolean(issue.completed_at) || Boolean(statuses.find((status) => status.id === issue.status_id)?.is_final);
  const status = statuses.find((item) => item.id === issue.status_id);
  return (
    <article className="issue-card">
      <Link to={`/issues/${issue.issue_key}`}>
        <small>{issue.issue_key}</small>
        <strong>{issue.title}</strong>
        <span className="issue-assignee">👤 {issue.assignee_name || 'Unassigned'}</span>
      </Link>
      <div className="issue-dates"><span>Created <b>{formatDate(issue.created_at)}</b></span><span>Completed <b>{formatDate(issue.completed_at)}</b></span></div>
      <div className="issue-meta">
        <span className={`priority priority-${issue.priority}`}>{issue.priority}</span>
        {canEdit && (!completed || canEditCompleted) ? (
          <select
            aria-label={`Status for ${issue.issue_key}`}
            value={issue.status_id}
            onChange={(event) => onStatusChange(issue.issue_key, Number(event.target.value))}
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </select>
        ) : <span className="status-lozenge">{status?.name || 'Status'}</span>}
      </div>
    </article>
  );
}
