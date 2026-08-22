import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as workspaceApi from '../api/workspace.api';

export default function ProjectDevelopmentPage() {
  const { project, role } = useOutletContext(); const [links, setLinks] = useState([]); const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', url: '', provider: 'GitHub', linkType: 'pull_request', issueKey: '', status: 'open' });
  const load = useCallback(() => workspaceApi.listDevelopmentLinks(project.id).then((r) => setLinks(r.developmentLinks)).catch((e) => setError(e.message)), [project.id]); useEffect(() => { load(); }, [load]);
  async function create(event) { event.preventDefault(); try { await workspaceApi.createDevelopmentLink(project.id, { ...form, issueKey: form.issueKey || null }); setForm({ ...form, title: '', url: '', issueKey: '' }); await load(); } catch (e) { setError(e.message); } }
  return <div><div className="view-heading"><div><h2>Development</h2><p>Connect branches, commits, pull requests, builds, and deployments to work.</p></div></div>{error && <p className="alert error">{error}</p>}
    {role !== 'viewer' && <form className="jira-card resource-form" onSubmit={create}><input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/><input required type="url" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}/><input placeholder="Issue key (optional)" value={form.issueKey} onChange={(e) => setForm({ ...form, issueKey: e.target.value.toUpperCase() })}/><select value={form.linkType} onChange={(e) => setForm({ ...form, linkType: e.target.value })}>{['branch','commit','pull_request','build','deployment'].map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}</select><button className="button primary">Add link</button></form>}
    <div className="resource-grid">{links.map((link) => <article className="jira-card dev-card" key={link.id}><div><span className="dev-icon">‹/›</span><div><small>{link.provider} · {link.link_type.replace('_', ' ')}</small><h3><a href={link.url} target="_blank" rel="noreferrer">{link.title}</a></h3></div></div><footer><span className="status-lozenge active">{link.status || 'linked'}</span><b>{link.issue_key || 'Project'}</b>{role !== 'viewer' && <button className="link-button" onClick={async () => { await workspaceApi.deleteDevelopmentLink(project.id, link.id); load(); }}>Remove</button>}</footer></article>)}{!links.length && <div className="jira-card empty-state"><span>‹/›</span><h3>No development links yet</h3><p>Connect work to the code and deployments that deliver it.</p></div>}</div>
  </div>;
}
