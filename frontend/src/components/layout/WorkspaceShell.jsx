import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import * as projectApi from '../../api/project.api';
import useAuth from '../../hooks/useAuth';
import ProjectHeader from './ProjectHeader';
import Sidebar from './Sidebar';

export default function WorkspaceShell() {
  const { projectId } = useParams(); const { user, logout } = useAuth(); const navigate = useNavigate();
  const [project, setProject] = useState(null); const [role, setRole] = useState('viewer'); const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('taskflow-sidebar') === 'collapsed');
  useEffect(() => { Promise.all([projectApi.getProject(projectId), projectApi.listProjects()]).then(([detail, list]) => { setProject(detail.project); setRole(list.projects.find((item) => item.id === Number(projectId))?.project_role ?? 'viewer'); }).catch((requestError) => setError(requestError.message)); }, [projectId]);
  function toggle() { setCollapsed((value) => { localStorage.setItem('taskflow-sidebar', value ? 'expanded' : 'collapsed'); return !value; }); }
  async function signOut() { await logout(); navigate('/login'); }
  if (!project) return <main className="page-center dark-page">{error || 'Loading workspace…'}</main>;
  return <div className="workspace">
    <Sidebar collapsed={collapsed} onToggle={toggle} project={project} />
    <div className="workspace-main">
      <div className="topbar"><Link className="mobile-brand" to="/projects">◆</Link><div className="global-search">⌕ <span>Search</span></div><Link className="button primary" to={`/projects/${projectId}/board`}>＋ Create</Link><div className="top-actions"><span>♢</span><span>⚙</span><button className="avatar-button" title={`${user?.name} — Sign out`} onClick={signOut}>{user?.name?.slice(0, 1).toUpperCase()}</button></div></div>
      <ProjectHeader project={project} role={role} />
      <main className="workspace-content"><Outlet context={{ project, role }} /></main>
    </div>
  </div>;
}
