import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as projectApi from '../api/project.api';

export default function ProjectListPage() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  const [error, setError] = useState('');

  async function load() {
    try { setProjects((await projectApi.listProjects()).projects); } catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { load(); }, []);

  async function create(event) {
    event.preventDefault();
    try {
      await projectApi.createProject(form);
      setForm({ key: '', name: '', description: '' });
      await load();
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <div className="content-grid">
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Workspace</p><h1>Your projects</h1></div><span className="count-pill">{projects.length}</span></div>
        {error && <p className="alert error">{error}</p>}
        <div className="project-list">
          {projects.map((project) => <Link className="project-row" key={project.id} to={`/projects/${project.id}`}><span className="project-key">{project.key}</span><span><strong>{project.name}</strong><small>{project.project_role}</small></span><span>→</span></Link>)}
          {!projects.length && <p className="muted">No projects yet. Create your first workspace.</p>}
        </div>
      </section>
      <section className="panel compact-panel"><p className="eyebrow">Start a workspace</p><h2>Create project</h2><form className="stack-form" onSubmit={create}><label>Project key<input required maxLength="10" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value.toUpperCase() })} /></label><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="button primary" type="submit">Create project</button></form></section>
    </div>
  );
}
