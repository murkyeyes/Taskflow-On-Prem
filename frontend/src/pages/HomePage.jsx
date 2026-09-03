import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import * as projectApi from '../api/project.api';
import * as settingsApi from '../api/settings.api';
import Sidebar from '../components/layout/Sidebar';
import SettingsMenu from '../components/layout/SettingsMenu';
import { useLocale } from '../contexts/LocaleContext';
import useAuth from '../hooks/useAuth';

const templateIcon = (key) => key === 'scrum' ? '↻' : key === 'work_requests' ? '☑' : key === 'personal' ? '♙' : key === 'business' ? '▤' : '▥';

export default function HomePage() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  const { locale } = useLocale();
  const [spaces, setSpaces] = useState([]); const [templates, setTemplates] = useState([]);
  const [query, setQuery] = useState(''); const [templateFilter, setTemplateFilter] = useState('all');
  const [sortDirection, setSortDirection] = useState('asc'); const [templatesOpen, setTemplatesOpen] = useState(true);
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem('taskflow-favorite-spaces') || '[]'); } catch { return []; } });
  const [error, setError] = useState(''); const [accountOpen, setAccountOpen] = useState(false);
  const [deletingSpaceId, setDeletingSpaceId] = useState(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('taskflow-sidebar') === 'collapsed');

  useEffect(() => { Promise.all([projectApi.listProjects(), settingsApi.listTemplates()]).then(([projectResult, templateResult]) => { setSpaces(projectResult.projects); setTemplates(templateResult.templates); }).catch((requestError) => setError(requestError.message)); }, []);
  const templateByKey = useMemo(() => Object.fromEntries(templates.map((template) => [template.key, template])), [templates]);
  const visibleSpaces = useMemo(() => {
    const term = query.trim().toLowerCase();
    return spaces.filter((space) => (!term || `${space.key} ${space.name} ${space.description ?? ''}`.toLowerCase().includes(term)) && (templateFilter === 'all' || space.template_key === templateFilter))
      .sort((left, right) => sortDirection === 'asc' ? left.name.localeCompare(right.name) : right.name.localeCompare(left.name));
  }, [query, sortDirection, spaces, templateFilter]);
  const canCreate = spaces.some((space) => space.project_role === 'admin');
  function toggle() { setCollapsed((value) => { localStorage.setItem('taskflow-sidebar', value ? 'expanded' : 'collapsed'); return !value; }); }
  function toggleFavorite(spaceId) { setFavorites((current) => { const next = current.includes(spaceId) ? current.filter((id) => id !== spaceId) : [...current, spaceId]; localStorage.setItem('taskflow-favorite-spaces', JSON.stringify(next)); return next; }); }
  async function signOut() { await logout(); navigate('/login'); }
  async function deleteSpace(space) {
    const message = locale === 'vi'
      ? `Xóa Không gian "${space.name}"? Không gian sẽ biến mất với mọi người dùng, nhưng công việc, báo cáo và lịch sử vẫn được lưu trữ.`
      : `Delete Space "${space.name}"? It will disappear for every user, but its tasks, reports, and history will remain stored.`;
    if (!window.confirm(message)) return;
    setError(''); setDeletingSpaceId(space.id);
    try {
      await projectApi.deleteProject(space.id);
      setSpaces((current) => current.filter((item) => item.id !== space.id));
      setFavorites((current) => {
        const next = current.filter((id) => id !== space.id);
        localStorage.setItem('taskflow-favorite-spaces', JSON.stringify(next));
        return next;
      });
    } catch (requestError) { setError(requestError.message); }
    finally { setDeletingSpaceId(null); }
  }

  return <div className="workspace home-workspace">
    <Sidebar collapsed={collapsed} onToggle={toggle} spaces={spaces} />
    <div className="workspace-main">
      <div className="topbar"><Link className="mobile-brand" to="/">◆</Link><div className="global-search"><span>⌕</span><input aria-label="Search Spaces" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{canCreate && <Link className="button primary" to="/spaces/new">＋ Create</Link>}<div className="top-actions"><SettingsMenu isAdmin={canCreate}/><button className="avatar-button" type="button" title="Account menu" onClick={() => setAccountOpen((value) => !value)}>{user?.name?.slice(0, 1).toUpperCase()}</button></div>{accountOpen && <div className="top-popover account-popover"><strong>{user?.name}</strong><small>{user?.email}</small><Link to="/settings/general">Personal settings</Link><button className="link-button" type="button" onClick={signOut}>Sign out</button></div>}</div>
      <main className={`space-directory ${templatesOpen && canCreate ? 'with-templates' : ''}`}>
        <section className="space-directory-main">
          <header className="space-directory-heading"><h1>Spaces</h1><div>{canCreate && <Link className="button primary" to="/spaces/new">Create Space</Link>}{canCreate && <button className={`button subtle ${templatesOpen ? 'selected' : ''}`} type="button" onClick={() => setTemplatesOpen((value) => !value)}>Templates</button>}</div></header>
          <div className="space-directory-toolbar"><div className="space-search"><span>⌕</span><input aria-label="Search spaces" placeholder="Search spaces" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select aria-label="Filter by template" value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)}><option value="all">Filter by template</option>{templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}</select></div>
          {error && <p className="alert error">{error}</p>}
          <div className="space-directory-table-wrap">
            <table className="space-directory-table">
              <thead><tr><th aria-label="Favorite">★</th><th><button type="button" onClick={() => setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')}>Name <span>{sortDirection === 'asc' ? '↓' : '↑'}</span></button></th><th>Key</th><th>Type</th><th>Access</th><th aria-label="Space actions" /></tr></thead>
              <tbody>
                {visibleSpaces.map((space) => {
                  const template = templateByKey[space.template_key]; const isFavorite = favorites.includes(space.id);
                  return <tr key={space.id}>
                    <td><button className={`favorite-button ${isFavorite ? 'active' : ''}`} type="button" aria-label={`${isFavorite ? 'Unstar' : 'Star'} ${space.name}`} onClick={() => toggleFavorite(space.id)}>{isFavorite ? '★' : '☆'}</button></td>
                    <td><Link className="space-name-cell" to={`/projects/${space.id}/summary`}><span className="project-avatar">{space.key.slice(0, 1)}</span><span><strong>{space.name}</strong><small>{space.description || 'No description provided.'}</small></span></Link></td>
                    <td>{space.key}</td>
                    <td><span>{template?.name || 'Kanban'}</span><small>{template?.category || 'Software development'}</small></td>
                    <td><span className="role-chip">{space.project_role === 'admin' ? 'Admin' : space.project_role === 'member' ? 'Member' : 'Viewer'}</span></td>
                    <td><details className="space-row-menu"><summary aria-label={`Actions for ${space.name}`}>•••</summary><div>
                      <Link to={`/projects/${space.id}/summary`}>Open Space</Link>
                      {space.project_role === 'admin' && <Link to={`/projects/${space.id}/settings`}>Space settings</Link>}
                      {['overall_admin', 'admin'].includes(user?.accountRole) && <button className="danger-menu-item" type="button" disabled={deletingSpaceId === space.id} onClick={() => deleteSpace(space)}>{deletingSpaceId === space.id ? 'Deleting…' : 'Delete Space'}</button>}
                    </div></details></td>
                  </tr>;
                })}
                {!visibleSpaces.length && <tr><td className="space-directory-empty" colSpan="6"><strong>{query || templateFilter !== 'all' ? 'No matching Spaces' : 'No Spaces assigned'}</strong><span>{query || templateFilter !== 'all' ? 'Try another search or template.' : 'Ask an Admin to assign you to a Space.'}</span></td></tr>}
              </tbody>
            </table>
          </div>
          <p className="space-directory-count">{visibleSpaces.length} {visibleSpaces.length === 1 ? 'Space' : 'Spaces'}</p>
        </section>
        {templatesOpen && canCreate && <aside className="space-template-rail"><header><div><h2>Templates</h2><p>Preview a template for your next Space</p></div><button className="icon-button" type="button" aria-label="Close templates" onClick={() => setTemplatesOpen(false)}>×</button></header><div className="space-template-list">{templates.map((template) => <Link key={template.key} to="/spaces/new"><span>{templateIcon(template.key)}</span><span><strong>{template.name}</strong><small>{template.description}</small></span></Link>)}</div><Link className="more-templates" to="/spaces/new">More templates</Link></aside>}
      </main>
    </div>
  </div>;
}
