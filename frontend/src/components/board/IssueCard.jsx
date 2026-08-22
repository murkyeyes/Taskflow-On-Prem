import { Link } from 'react-router-dom';

export default function IssueCard({ issue, statuses, canEdit, onStatusChange }) {
  return (
    <article className="issue-card">
      <Link to={`/issues/${issue.issue_key}`}>
        <small>{issue.issue_key}</small>
        <strong>{issue.title}</strong>
      </Link>
      <div className="issue-meta">
        <span className={`priority priority-${issue.priority}`}>{issue.priority}</span>
        {canEdit && (
          <select
            aria-label={`Status for ${issue.issue_key}`}
            value={issue.status_id}
            onChange={(event) => onStatusChange(issue.issue_key, Number(event.target.value))}
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </select>
        )}
      </div>
    </article>
  );
}
