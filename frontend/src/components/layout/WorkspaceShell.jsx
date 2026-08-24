import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import * as issueApi from '../../api/issue.api';
import * as projectApi from '../../api/project.api';
import IssueForm from '../issue/IssueForm';
import useAuth from '../../hooks/useAuth';
import ProjectHeader from './ProjectHeader';
import Sidebar from './Sidebar';
import SettingsMenu from './SettingsMenu';

export default function WorkspaceShell() {
  const { projectId } = useParams(); const { user, logout } = useAuth(); const navigate = useNavigate();
  const [project, setProject] = useState(null); const [spaces, setSpaces] = useState([]); const [role, setRole] = useState('viewer'); const [error, setError] = useState('');
  const [types, setTypes] = useState([]); const [statuses, setStatuses] = useState([]); const [assignees, setAssignees] = useState([]);
  const [search, setSearch] = useState(''); const [searchResults, setSearchResults] = useState([]);
  const [createOpen, setCreateOpen] = useState(false); const [activityOpen, setActivityOpen] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [message, setMessage] = useState('');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('taskflow-sidebar') === 'collapsed');
  useEffect(() => { Promise.all([projectApi.getProject(projectId), projectApi.listProjects(), projectApi.listIssueTypes(projectId), projectApi.listWorkflowStatuses(projectId), projectApi.listAssignees(projectId)]).then(([detail, list, typeResult, statusResult, assigneeResult]) => { setProject(detail.project); setSpaces(list.projects); setRole(list.projects.find((item) => item.id === Number(projectId))?.project_role ?? 'viewer'); setTypes(typeResult.issueTypes); setStatuses(statusResult.workflowStatuses); setAssignees(assigneeResult.assignees); }).catch((requestError) => setError(requestError.message)); }, [projectId]);
  useEffect(() => {
    function updateSpace(event) {
      const updated = event.detail;
      if (!updated?.id) return;
      setSpaces((current) => current.map((space) => Number(space.id) === Number(updated.id) ? { ...space, ...updated } : space));
      if (Number(updated.id) === Number(projectId)) setProject((current) => ({ ...current, ...updated }));
    }
    window.addEventListener('taskflow:space-updated', updateSpace);
    return () => window.removeEventListener('taskflow:space-updated', updateSpace);
  }, [projectId]);
  useEffect(() => { if (!search.trim()) { setSearchResults([]); return undefined; } const timer = setTimeout(() => { issueApi.listIssues(projectId, { search: search.trim(), page: 1, pageSize: 8 }).then((result) => setSearchResults(result.issues)).catch((requestError) => setError(requestError.message)); }, 180); return () => clearTimeout(timer); }, [projectId, search]);
  function toggle() { setCollapsed((value) => { localStorage.setItem('taskflow-sidebar', value ? 'expanded' : 'collapsed'); return !value; }); }
  async function signOut() { await logout(); navigate('/login'); }
  async function createIssue(data) { try { setError(''); const result = await issueApi.createIssue(projectId, data); setCreateOpen(false); setMessage(`${result.issue.issue_key} created.`); navigate(`/issues/${result.issue.issue_key}`); } catch (requestError) { setError(requestError.message); } }
  function searchSubmit(event) { event.preventDefault(); if (searchResults[0]) navigate(`/issues/${searchResults[0].issue_key}`); else if (search.trim()) navigate(`/projects/${projectId}/board`); }
  if (!project) return <main className="page-center dark-page">{error || 'Loading workspace…'}</main>;
  return <div className="workspace">
    <Sidebar collapsed={collapsed} onToggle={toggle} project={project} spaces={spaces} />
    <div className="workspace-main">
      <div className="topbar"><Link className="mobile-brand" to="/">◆</Link><form className="global-search" onSubmit={searchSubmit}><span>⌕</span><input aria-label="Search Space issues" placeholder="Search issues by key or title" value={search} onChange={(event) => setSearch(event.target.value)} />{searchResults.length > 0 && <div className="top-popover search-results">{searchResults.map((issue) => <Link key={issue.id} to={`/issues/${issue.issue_key}`} onClick={() => setSearch('')}><small>{issue.issue_key}</small><span>{issue.title}</span></Link>)}</div>}</form>{['admin', 'member'].includes(role) && <button className="button primary" type="button" onClick={() => { setCreateOpen((value) => !value); setActivityOpen(false); setAccountOpen(false); }}>＋ Create</button>}<div className="top-actions"><button className="top-action-button" type="button" title="Space activity" onClick={() => { setActivityOpen((value) => !value); setCreateOpen(false); setAccountOpen(false); }}>♢</button><SettingsMenu isAdmin={role === 'admin'} /><button className="avatar-button" type="button" title="Account menu" onClick={() => { setAccountOpen((value) => !value); setCreateOpen(false); setActivityOpen(false); }}>{user?.name?.slice(0, 1).toUpperCase()}</button></div>
        {createOpen && <div className="top-popover create-popover"><header><strong>Create issue</strong><button className="icon-button" type="button" onClick={() => setCreateOpen(false)}>×</button></header><IssueForm compact issueTypes={types} assignees={role === 'admin' ? assignees : assignees.filter((member) => member.user_id === user?.id)} restrictAssigneeToUserId={role === 'admin' ? null : user?.id} defaultStatusId={statuses.find((status) => status.is_default)?.id ?? statuses[0]?.id ?? ''} submitLabel="Create issue" onSubmit={createIssue} /></div>}
        {activityOpen && <div className="top-popover activity-popover"><strong>Space activity</strong><p className="muted">See recent issue changes, workload, and due dates.</p><Link className="button subtle" to={`/projects/${projectId}/summary`} onClick={() => setActivityOpen(false)}>Open Summary</Link></div>}
        {accountOpen && <div className="top-popover account-popover"><strong>{user?.name}</strong><small>{user?.email}</small><Link to="/" onClick={() => setAccountOpen(false)}>All Spaces</Link><button className="link-button" type="button" onClick={signOut}>Sign out</button></div>}
      </div>
      <ProjectHeader project={project} role={role} />
      <main className="workspace-content">{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}<Outlet context={{ project, role }} /></main>
    </div>
  </div>;
}
