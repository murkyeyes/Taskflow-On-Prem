import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as projectApi from '../api/project.api';
import * as authApi from '../api/auth.api';
import useAuth from '../hooks/useAuth';

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [types, setTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [projectResult, memberResult, typeResult, statusResult, projects, accountResult] = await Promise.all([
        projectApi.getProject(projectId), projectApi.listMembers(projectId), projectApi.listIssueTypes(projectId),
        projectApi.listWorkflowStatuses(projectId), projectApi.listProjects(), authApi.listUsers(),
      ]);
      setProject(projectResult.project); setMembers(memberResult.members); setTypes(typeResult.issueTypes); setStatuses(statusResult.workflowStatuses); setAccounts(accountResult.users);
      setRole(projects.projects.find((item) => item.id === Number(projectId))?.project_role ?? 'viewer');
    } catch (requestError) { setError(requestError.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function submit(event, action) {
    event.preventDefault(); setError(''); setMessage('');
    try { await action(new FormData(event.currentTarget)); event.currentTarget.reset(); await load(); setMessage('Saved.'); }
    catch (requestError) { setError(requestError.message); }
  }
  if (!project) return <div className="panel"><p>{error || 'Loading settings…'}</p></div>;
  if (role !== 'admin') return <div className="panel"><p className="alert error">Only Space administrators can manage settings.</p><Link to={`/projects/${projectId}/board`}>Back to board</Link></div>;
  return <div className="settings-page"><div className="section-heading"><div><p className="eyebrow">{project.key} · Space administration</p><h1>{project.name} settings</h1></div><Link className="button subtle" to={`/projects/${projectId}/board`}>Back to board</Link></div>{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}
    <section className="settings-grid">
      <div className="panel"><h2>Create account</h2><p className="muted">Only Space administrators can provision accounts.</p><form onSubmit={(event) => submit(event, async (data) => { const result = await authApi.register({ name: data.get('name'), email: data.get('email'), password: data.get('password') }); setMessage(`Account created (user #${result.user.id}). Add it as a viewer below.`); })} className="stack-form"><label>Account name<input name="name" required maxLength="120" /></label><label>Email<input name="email" type="email" required /></label><label>Temporary password<input name="password" type="password" minLength="8" required /></label><button className="button primary">Create account</button></form></div>
      <div className="panel"><h2>Space viewers</h2><p className="muted">Assigned viewers can open only this Space and cannot make changes.</p><form onSubmit={(event) => submit(event, (data) => projectApi.addMember(projectId, { userId: Number(data.get('userId')), projectRole: 'viewer' }))} className="stack-form"><label>Account<select name="userId" required defaultValue=""><option value="" disabled>Select account by name</option>{accounts.filter((account) => !members.some((member) => member.user_id === account.id)).map((account) => <option key={account.id} value={account.id}>{account.name} — {account.email}</option>)}</select></label><button className="button primary">Assign viewer</button></form><ul className="settings-list">{members.map((member) => <li key={member.user_id}><span>{member.name} <span className="muted">{member.email}</span></span><span className="muted">{member.project_role === 'admin' ? 'Space admin' : 'Viewer'}</span>{member.project_role !== 'admin' && <button className="link-button" onClick={() => projectApi.deleteMember(projectId, member.user_id).then(load)}>Remove</button>}</li>)}</ul></div>
      <div className="panel"><h2>Issue types</h2><form onSubmit={(event) => submit(event, (data) => projectApi.createIssueType(projectId, { name: data.get('name'), color: data.get('color') }))} className="inline-form"><input name="name" placeholder="Bug, Story…" required /><input name="color" placeholder="#4f46e5" /><button className="button primary">Add</button></form><ul className="settings-list">{types.map((type) => <li key={type.id}><span>{type.name}</span><button className="link-button" onClick={() => projectApi.deleteIssueType(projectId, type.id).then(load)}>Delete</button></li>)}</ul></div>
      <div className="panel"><h2>Workflow statuses</h2><form onSubmit={(event) => submit(event, (data) => projectApi.createWorkflowStatus(projectId, { name: data.get('name'), position: Number(data.get('position') || statuses.length) }))} className="inline-form"><input name="name" placeholder="In review" required /><input name="position" type="number" min="0" placeholder="Position" /><button className="button primary">Add</button></form><ol className="settings-list">{statuses.map((status) => <li key={status.id}><span>{status.position}. {status.name}</span><button className="link-button" onClick={() => projectApi.deleteWorkflowStatus(projectId, status.id).then(load)}>Delete</button></li>)}</ol></div>
    </section><p className="muted">Signed in as user #{user?.id}. Changes are restricted to administrators.</p></div>;
}
