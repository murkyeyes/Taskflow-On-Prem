import { useState } from 'react';

function documentKind(attachment) {
  const value = `${attachment.file_name} ${attachment.external_url}`.toLowerCase();
  if (/\.xlsx?\b|spreadsheets/.test(value)) return { className: 'excel', icon: 'X', label: 'Excel' };
  if (/\.docx?\b|\/document\//.test(value)) return { className: 'word', icon: 'W', label: 'Word' };
  if (/\.pdf\b/.test(value)) return { className: 'pdf', icon: 'PDF', label: 'PDF' };
  return { className: 'online', icon: '↗', label: 'Online document' };
}

export default function ReportFiles({ attachments, canMutate, locked, onAddLink, onDownload, onDelete }) {
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    try {
      if (await onAddLink({ url: data.get('reportUrl'), title: data.get('reportTitle') || null }) !== false) form.reset();
    } finally {
      setSaving(false);
    }
  }

  return <div className="report-files">
    <h2>Report links</h2>
    <p className="muted">Paste a sharing link to view Excel, Word, or PDF reports online without storing file data in Taskflow.</p>
    {locked && <p className="alert completed-lock">This task is completed. Only an Admin can add or remove report links.</p>}
    {canMutate && <form className="report-link-form" onSubmit={submit}>
      <label>Document link<input aria-label="Document link" name="reportUrl" type="url" inputMode="url" placeholder="https://..." pattern="https://.*" required /></label>
      <label>Display name <small>(optional)</small><input aria-label="Display name" name="reportTitle" maxLength="255" placeholder="January daily report.xlsx" /></label>
      <button className="button primary" disabled={saving} type="submit">{saving ? 'Adding…' : 'Add report link'}</button>
    </form>}
    <div className="report-card-list">
      {attachments.length === 0 && <div className="empty-report"><span>↗</span><p>No report links added.</p></div>}
      {attachments.map((attachment) => {
        if (!attachment.external_url) return <article className="report-file legacy-report" key={attachment.id}>
          <span className="report-file-icon">▤</span>
          <div><strong>{attachment.file_name}</strong><small>Legacy stored file · Added by {attachment.uploaded_by_name ?? `User ${attachment.uploaded_by}`} · {new Date(attachment.created_at).toLocaleString()}</small></div>
          <button className="link-button" type="button" onClick={() => onDownload(attachment)}>Download</button>
          {canMutate && <button className="link-button danger-link" type="button" onClick={() => onDelete(attachment.id)}>Delete</button>}
        </article>;
        const kind = documentKind(attachment);
        let host = attachment.provider;
        try { host ||= new URL(attachment.external_url).hostname; } catch { host ||= 'Online document'; }
        return <article className="report-link-card" key={attachment.id}>
          <a href={attachment.external_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${attachment.file_name}`}>
            <div className="report-link-title">{attachment.file_name}</div>
            <div className="report-link-preview"><span className={`document-app-icon ${kind.className}`}>{kind.icon}</span></div>
            <footer><span className={`document-mini-icon ${kind.className}`}>{kind.icon}</span><span><strong>{attachment.file_name}</strong><small>{kind.label} · {host}</small><small>Added by {attachment.uploaded_by_name ?? `User ${attachment.uploaded_by}`} · {new Date(attachment.created_at).toLocaleString()}</small></span><b>•••</b></footer>
          </a>
          {canMutate && <button aria-label={`Delete ${attachment.file_name}`} title="Delete" className="report-card-delete danger-link" type="button" onClick={() => onDelete(attachment.id)}>×</button>}
        </article>;
      })}
    </div>
  </div>;
}
