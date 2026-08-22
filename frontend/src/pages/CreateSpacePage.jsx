import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import * as authApi from '../api/auth.api';
import * as projectApi from '../api/project.api';
import Sidebar from '../components/layout/Sidebar';
import useAuth from '../hooks/useAuth';

export default function CreateSpacePage() {
  const { user } = useAuth(); const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]); const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ key: '', name: '', description: '', viewerIds: [] });
  const [accountSearch, setAccountSearch] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('taskflow-sidebar') === 'collapsed');

  useEffect(() => { projectApi.listProjects().then(async (result) => { setSpaces(result.projects); if (result.projects.some((space) => space.project_role === 'admin')) setAccounts((await authApi.listUsers()).users); }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)); }, []);
  const canCreate = spaces.some((space) => space.project_role === 'admin');
  const filteredAccounts = useMemo(() => { const term = accountSearch.trim().toLowerCase(); return accounts.filter((account) => account.id !== user?.id && (!term || `${account.name} ${account.email}`.toLowerCase().includes(term))); }, [accountSearch, accounts, user?.id]);
  function toggle() { setCollapsed((value) => { localStorage.setItem('taskflow-sidebar', value ? 'expanded' : 'collapsed'); return !value; }); }
  function toggleViewer(id) { setForm((current) => ({ ...current, viewerIds: current.viewerIds.includes(id) ? current.viewerIds.filter((item) => item !== id) : [...current.viewerIds, id] })); }
  async function create(event) { event.preventDefault(); setError(''); try { const result = await projectApi.createProject(form); navigate(`/projects/${result.project.id}/summary`); } catch (requestError) { setError(requestError.message); } }

  return <div className="workspace">
    <Sidebar collapsed={collapsed} onToggle={toggle} spaces={spaces} />
    <div className="workspace-main"><div className="topbar"><Link className="button subtle" to="/">← Back to Spaces</Link><strong className="topbar-title">Create Space</strong></div><main className="workspace-content create-space-content">
      {loading && <p>Loading Space access…</p>}{error && <p className="alert error">{error}</p>}
      {!loading && !canCreate && <div className="jira-card empty-state"><span>🔒</span><h1>Admin access required</h1><p>Only an Admin can create a Space.</p><Link className="button subtle" to="/">Return home</Link></div>}
      {!loading && canCreate && <div className="create-space-layout"><section><p className="eyebrow">Admin</p><h1>Name your Space</h1><p className="muted">Create the Space and choose the accounts that receive read-only access.</p><form className="stack-form create-space-form" onSubmit={create}><label>Space name<input required maxLength="200" placeholder="Try a team name, goal, or milestone" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Space key<input required maxLength="10" pattern="[A-Za-z][A-Za-z0-9]*" placeholder="TEAM" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value.toUpperCase() })} /></label><label>Description<textarea maxLength="10000" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Find accounts<input placeholder="Search by account name or email" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></label><fieldset className="account-picker"><legend>Assign viewers ({form.viewerIds.length})</legend>{filteredAccounts.map((account) => <label key={account.id}><input type="checkbox" checked={form.viewerIds.includes(account.id)} onChange={() => toggleViewer(account.id)} /><span><strong>{account.name}</strong><small>{account.email}</small></span></label>)}{!filteredAccounts.length && <p className="muted">No matching accounts.</p>}</fieldset><div className="form-actions"><Link className="button subtle" to="/">Cancel</Link><button className="button primary" type="submit">Create Space</button></div></form></section><aside className="space-preview"><p className="muted">Space preview</p><h2>{form.name || 'My Space'}</h2><div className="preview-tabs"><span>Summary</span><b>Board</b><span>Timeline</span><span>Development</span></div><div className="preview-board">{['To Do', 'In Progress', 'Done'].map((status) => <div key={status}><strong>{status}</strong><i /></div>)}</div></aside></div>}
    </main></div>
  </div>;
}
