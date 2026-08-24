import { Link, NavLink } from 'react-router-dom';

const mainItems = [
  ['◎', 'For you', '/'], ['◷', 'Recent', '/'], ['☆', 'Starred', '/'],
  ['▦', 'Apps', '/'], ['☷', 'Plans', '/'],
];

export default function Sidebar({ collapsed, onToggle, project, spaces = [] }) {
  const projectBase = project ? `/projects/${project.id}` : '/';
  const canCreate = spaces.some((space) => space.project_role === 'admin');
  return <aside className={`jira-sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="side-brand"><button aria-label="Toggle sidebar" className="icon-button" onClick={onToggle}>☰</button><Link className="side-home" to="/"><span className="jira-mark">◆</span><strong>Taskflow</strong></Link></div>
    <nav className="side-nav">
      {mainItems.map(([icon, label, to]) => <NavLink key={label} to={to}><span>{icon}</span><b>{label}</b></NavLink>)}
      <div className="side-section"><Link to="/"><span>Spaces</span></Link>{canCreate && <Link className="space-add" to="/spaces/new" aria-label="Create Space" title="Create Space">＋</Link>}</div>
      <div className="space-links">{spaces.map((space) => {
        const active = Number(project?.id) === Number(space.id); const base = `/projects/${space.id}`;
        const enabled = space.enabled_features || ['summary','backlog','board','development','timeline','docs','forms'];
        return <div className="space-link-group" key={space.id}>
          <NavLink className={`project-side-link ${active ? 'current-space' : ''}`} to={`${base}/summary`}><span className="project-avatar">{space.key.slice(0, 1)}</span><b>{space.name}</b></NavLink>
          {active && <div className="side-subnav">
            {enabled.includes('backlog')&&<NavLink to={`${base}/backlog`}>☷ <b>Backlog</b></NavLink>}
            {enabled.includes('board')&&<NavLink to={`${base}/board`}>▥ <b>Board</b></NavLink>}
            {enabled.includes('timeline')&&<NavLink to={`${base}/timeline`}>⌁ <b>Timeline</b></NavLink>}
            {enabled.includes('development')&&<NavLink to={`${base}/development`}>‹/› <b>Development</b></NavLink>}
            {enabled.includes('docs')&&<NavLink to={`${base}/docs`}>▤ <b>Docs</b></NavLink>}
            {enabled.includes('forms')&&<NavLink to={`${base}/forms`}>☷ <b>Forms</b></NavLink>}
          </div>}
        </div>;
      })}</div>
      <NavLink to={project ? `${projectBase}/summary` : '/'}><span>▦</span><b>Dashboards</b></NavLink>
      {canCreate && <NavLink to="/teams"><span>♚</span><b>Teams</b></NavLink>}
    </nav>
  </aside>;
}
