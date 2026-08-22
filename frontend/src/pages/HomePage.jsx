import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import * as projectApi from '../api/project.api';
import Sidebar from '../components/layout/Sidebar';
import useAuth from '../hooks/useAuth';

export default function HomePage() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]); const [query, setQuery] = useState('');
  const [error, setError] = useState(''); const [accountOpen, setAccountOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('taskflow-sidebar') === 'collapsed');

  useEffect(() => { projectApi.listProjects().then((result) => setSpaces(result.projects)).catch((requestError) => setError(requestError.message)); }, []);
  const visibleSpaces = useMemo(() => { const term = query.trim().toLowerCase(); return term ? spaces.filter((space) => `${space.key} ${space.name} ${space.description ?? ''}`.toLowerCase().includes(term)) : spaces; }, [query, spaces]);
  const canCreate = spaces.some((space) => space.project_role === 'admin');
  function toggle() { setCollapsed((value) => { localStorage.setItem('taskflow-sidebar', value ? 'expanded' : 'collapsed'); return !value; }); }
  async function signOut() { await logout(); navigate('/login'); }

  return <div className="workspace home-workspace">
    <Sidebar collapsed={collapsed} onToggle={toggle} spaces={spaces} />
    <div className="workspace-main">
      <div className="topbar"><Link className="mobile-brand" to="/">◆</Link><div className="global-search"><span>⌕</span><input aria-label="Search Spaces" placeholder="Search Spaces by key or name" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{canCreate && <Link className="button primary" to="/spaces/new">＋ Create Space</Link>}<div className="top-actions"><button className="avatar-button" type="button" title="Account menu" onClick={() => setAccountOpen((value) => !value)}>{user?.name?.slice(0, 1).toUpperCase()}</button></div>{accountOpen && <div className="top-popover account-popover"><strong>{user?.name}</strong><small>{user?.email}</small><button className="link-button" type="button" onClick={signOut}>Sign out</button></div>}</div>
      <main className="workspace-content home-content"><div className="home-heading"><div><p className="eyebrow">Taskflow home</p><h1>Choose a Space</h1><p className="muted">Open a Space to view its work. Your sidebar always shows the same accessible Spaces.</p></div>{canCreate && <Link className="button primary" to="/spaces/new">Create Space</Link>}</div>
        {error && <p className="alert error">{error}</p>}
        <section className="space-home-grid">{visibleSpaces.map((space) => <Link className="space-home-card" key={space.id} to={`/projects/${space.id}/summary`}><span className="space-home-avatar">{space.key.slice(0, 1)}</span><div><small>{space.key}</small><h2>{space.name}</h2><p>{space.description || 'No description provided.'}</p><span className="role-chip">{space.project_role === 'admin' ? 'Admin' : space.project_role === 'member' ? 'Member' : 'Viewer'}</span></div><b>→</b></Link>)}</section>
        {!visibleSpaces.length && <div className="jira-card empty-state"><span>▦</span><h2>{query ? 'No matching Spaces' : 'No Spaces assigned'}</h2><p>{query ? 'Try another key or name.' : 'Ask an Admin to assign you to a Space.'}</p></div>}
      </main>
    </div>
  </div>;
}
