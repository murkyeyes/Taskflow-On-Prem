import { useState } from 'react';

function readableSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReportFiles({ attachments, canMutate, locked, onUpload, onDownload, onDelete }) {
  const [uploading, setUploading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const input = event.currentTarget.elements.reportFile;
    if (!input.files?.[0]) return;
    setUploading(true);
    try {
      if (await onUpload(input.files[0]) !== false) event.currentTarget.reset();
    } finally {
      setUploading(false);
    }
  }

  return <div className="report-files">
    <h2>Report files</h2>
    <p className="muted">Upload PDF, Word, or Excel reports. Maximum file size: 10 MB.</p>
    {locked && <p className="alert completed-lock">This task is completed. Only an Admin can add or remove report files.</p>}
    {canMutate && <form className="report-upload" onSubmit={submit}>
      <input aria-label="Report file" name="reportFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      <button className="button primary" disabled={uploading} type="submit">{uploading ? 'Uploading…' : 'Upload report'}</button>
    </form>}
    <div className="report-file-list">
      {attachments.length === 0 && <div className="empty-report"><span>▤</span><p>No report files uploaded.</p></div>}
      {attachments.map((attachment) => <article className="report-file" key={attachment.id}>
        <span className="report-file-icon">▤</span>
        <div><strong>{attachment.file_name}</strong><small>{readableSize(attachment.file_size)} · Uploaded by {attachment.uploaded_by_name ?? `User ${attachment.uploaded_by}`} · {new Date(attachment.created_at).toLocaleString()}</small></div>
        <button className="link-button" type="button" onClick={() => onDownload(attachment)}>Download</button>
        {canMutate && <button className="link-button danger-link" type="button" onClick={() => onDelete(attachment.id)}>Delete</button>}
      </article>)}
    </div>
  </div>;
}
