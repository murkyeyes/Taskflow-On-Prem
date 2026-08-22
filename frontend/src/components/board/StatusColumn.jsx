import IssueCard from './IssueCard';

export default function StatusColumn({ status, issues, statuses, canEdit, onStatusChange }) {
  return (
    <section className="status-column">
      <header>
        <h2>{status.name}</h2>
        <span>{issues.length}</span>
      </header>
      <div className="status-cards">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            statuses={statuses}
            canEdit={canEdit}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </section>
  );
}
