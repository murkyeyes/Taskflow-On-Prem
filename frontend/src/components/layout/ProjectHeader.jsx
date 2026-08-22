import { NavLink } from 'react-router-dom';

const tabs = [['◉', 'Summary', 'summary'], ['▤', 'Backlog', 'backlog'], ['▥', 'Board', 'board'], ['‹/›', 'Development', 'development'], ['⌁', 'Timeline', 'timeline'], ['▣', 'Docs', 'docs'], ['☷', 'Forms', 'forms']];

export default function ProjectHeader({ project, role }) {
  const base = `/projects/${project.id}`;
  return <header className="project-header">
    <div className="project-title"><span className="project-avatar">{project.key.slice(0, 1)}</span><div><small>Spaces</small><h1>{project.name}</h1></div><span className="role-chip">{role}</span><NavLink className="icon-button" to={`${base}/settings`} title="Project settings">•••</NavLink></div>
    <nav className="project-tabs" aria-label="Project views">
      {tabs.map(([icon, label, path]) => <NavLink key={path} to={`${base}/${path}`}><span>{icon}</span>{label}</NavLink>)}
    </nav>
  </header>;
}
