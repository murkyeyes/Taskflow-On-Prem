import { NavLink } from 'react-router-dom';

const mainItems = [
  ['◎', 'For you', '/projects'], ['◷', 'Recent', '/projects'], ['☆', 'Starred', '/projects'],
  ['▦', 'Apps', '/projects'], ['☷', 'Plans', '/projects'],
];

export default function Sidebar({ collapsed, onToggle, project }) {
  const projectBase = project ? `/projects/${project.id}` : '/projects';
  return <aside className={`jira-sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="side-brand"><button aria-label="Toggle sidebar" className="icon-button" onClick={onToggle}>☰</button><span className="jira-mark">◆</span><strong>Taskflow</strong></div>
    <nav className="side-nav">
      {mainItems.map(([icon, label, to]) => <NavLink key={label} to={to}><span>{icon}</span><b>{label}</b></NavLink>)}
      <div className="side-section"><span>Spaces</span><i>＋</i></div>
      {project && <>
        <NavLink className="project-side-link" to={`${projectBase}/summary`}><span className="project-avatar">{project.key.slice(0, 1)}</span><b>{project.name}</b></NavLink>
        <div className="side-subnav">
          <NavLink to={`${projectBase}/backlog`}>☷ <b>Backlog</b></NavLink>
          <NavLink to={`${projectBase}/board`}>▥ <b>Board</b></NavLink>
          <NavLink to={`${projectBase}/timeline`}>⌁ <b>Timeline</b></NavLink>
          <NavLink to={`${projectBase}/development`}>‹/› <b>Development</b></NavLink>
          <NavLink to={`${projectBase}/docs`}>▤ <b>Docs</b></NavLink>
          <NavLink to={`${projectBase}/forms`}>☷ <b>Forms</b></NavLink>
        </div>
      </>}
      <NavLink to={project ? `${projectBase}/summary` : '/projects'}><span>▦</span><b>Dashboards</b></NavLink>
      <NavLink to={project ? `${projectBase}/settings` : '/projects'}><span>♚</span><b>Teams</b></NavLink>
    </nav>
  </aside>;
}
