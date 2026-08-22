import { useEffect, useState } from 'react';

const emptyIssue = {
  title: '',
  description: '',
  issueTypeId: '',
  assigneeId: '',
  priority: 'medium',
  dueDate: '',
  statusId: '',
};

export default function IssueForm({ issueTypes, assignees = [], initialIssue, defaultStatusId = '', onSubmit, submitLabel = 'Save issue', compact = false, onCancel }) {
  const [form, setForm] = useState(emptyIssue);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  useEffect(() => {
    setForm(initialIssue ? {
      title: initialIssue.title ?? '',
      description: initialIssue.description ?? '',
      issueTypeId: initialIssue.issue_type_id ?? '',
      assigneeId: initialIssue.assignee_id ?? '',
      priority: initialIssue.priority ?? 'medium',
      dueDate: initialIssue.due_date ?? '',
      statusId: initialIssue.status_id ?? defaultStatusId,
    } : { ...emptyIssue, issueTypeId: issueTypes[0]?.id ?? '', statusId: defaultStatusId });
    const current = assignees.find((member) => member.user_id === initialIssue?.assignee_id);
    setAssigneeSearch(current ? `${current.name} <${current.email}>` : '');
  }, [assignees, defaultStatusId, initialIssue, issueTypes]);

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
      dueDate: form.dueDate || null,
      ...(form.statusId ? { statusId: Number(form.statusId) } : {}),
    });
    if (!initialIssue) {
      setForm({ ...emptyIssue, issueTypeId: issueTypes[0]?.id ?? '', statusId: defaultStatusId }); setAssigneeSearch('');
    }
  }

  return (
    <form className={`stack-form ${compact ? 'compact-form' : ''}`} onSubmit={submit}>
      <label>Title<input required maxLength="255" value={form.title} onChange={(event) => setField('title', event.target.value)} /></label>
      <label>Description<textarea value={form.description} onChange={(event) => setField('description', event.target.value)} /></label>
      <label>Issue type<select required value={form.issueTypeId} onChange={(event) => setField('issueTypeId', event.target.value)}>
        {issueTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select></label>
      <label>Assignee account<input list="project-assignee-options" placeholder="Search account name" value={assigneeSearch} onChange={(event) => { const value = event.target.value; setAssigneeSearch(value); const member = assignees.find((item) => `${item.name} <${item.email}>` === value); setField('assigneeId', member?.user_id ?? ''); }} /><datalist id="project-assignee-options">{assignees.map((member) => <option key={member.user_id} value={`${member.name} <${member.email}>`}>{member.project_role}</option>)}</datalist></label>
      <label>Due date<input type="date" value={form.dueDate} onChange={(event) => setField('dueDate', event.target.value)} /></label>
      <label>Priority<select value={form.priority} onChange={(event) => setField('priority', event.target.value)}>
        {['lowest', 'low', 'medium', 'high', 'highest'].map((priority) => <option key={priority}>{priority}</option>)}
      </select></label>
      <div className="form-actions"><button className="button primary" type="submit">{submitLabel}</button>{onCancel && <button className="button subtle" type="button" onClick={onCancel}>Cancel</button>}</div>
    </form>
  );
}
