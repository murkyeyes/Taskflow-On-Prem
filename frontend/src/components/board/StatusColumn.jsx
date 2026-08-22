import IssueCard from './IssueCard';
import { useState } from 'react';
import IssueForm from '../issue/IssueForm';

export default function StatusColumn({ status, issues, statuses, canEdit, onStatusChange, issueTypes, assignees, onCreate }) {
  const [creating, setCreating] = useState(false);
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
        {canEdit && creating && <IssueForm compact issueTypes={issueTypes} assignees={assignees} defaultStatusId={status.id} submitLabel={`Create in ${status.name}`} onCancel={() => setCreating(false)} onSubmit={async (data) => { await onCreate(data); setCreating(false); }} />}
      </div>
      {canEdit && <button className="link-button board-create" type="button" onClick={() => setCreating((value) => !value)}>+ Create</button>}
    </section>
  );
}
