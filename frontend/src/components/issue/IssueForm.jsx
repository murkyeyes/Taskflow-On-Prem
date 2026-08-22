import { useEffect, useState } from 'react';

const emptyIssue = {
  title: '',
  description: '',
  issueTypeId: '',
  assigneeId: '',
  priority: 'medium',
};

export default function IssueForm({ issueTypes, initialIssue, onSubmit, submitLabel = 'Save issue' }) {
  const [form, setForm] = useState(emptyIssue);

  useEffect(() => {
    setForm(initialIssue ? {
      title: initialIssue.title ?? '',
      description: initialIssue.description ?? '',
      issueTypeId: initialIssue.issue_type_id ?? '',
      assigneeId: initialIssue.assignee_id ?? '',
      priority: initialIssue.priority ?? 'medium',
    } : { ...emptyIssue, issueTypeId: issueTypes[0]?.id ?? '' });
  }, [initialIssue, issueTypes]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    await onSubmit({
      title: form.title,
      description: form.description || null,
      issueTypeId: Number(form.issueTypeId),
      assigneeId: form.assigneeId === '' ? null : Number(form.assigneeId),
      priority: form.priority,
    });
    if (!initialIssue) {
      setForm({ ...emptyIssue, issueTypeId: issueTypes[0]?.id ?? '' });
    }
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      <label>Title<input required maxLength="255" value={form.title} onChange={(event) => setField('title', event.target.value)} /></label>
      <label>Description<textarea value={form.description} onChange={(event) => setField('description', event.target.value)} /></label>
      <label>Issue type<select required value={form.issueTypeId} onChange={(event) => setField('issueTypeId', event.target.value)}>
        {issueTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select></label>
      <label>Assignee user ID<input min="1" type="number" value={form.assigneeId} onChange={(event) => setField('assigneeId', event.target.value)} /></label>
      <label>Priority<select value={form.priority} onChange={(event) => setField('priority', event.target.value)}>
        {['lowest', 'low', 'medium', 'high', 'highest'].map((priority) => <option key={priority}>{priority}</option>)}
      </select></label>
      <button className="button primary" type="submit">{submitLabel}</button>
    </form>
  );
}
