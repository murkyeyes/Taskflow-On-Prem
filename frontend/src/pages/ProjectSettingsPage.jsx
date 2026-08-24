import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as projectApi from '../api/project.api';
import useAuth from '../hooks/useAuth';

function IssueTypeEditor({ type, onSave, onDelete }) {
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState(type.color || '#4f46e5');
  useEffect(() => { setName(type.name); setColor(type.color || '#4f46e5'); }, [type]);
  return <form className="settings-editor-row" onSubmit={(event) => { event.preventDefault(); onSave(type.id, { name, color }); }}>
    <input aria-label={`Issue type name ${type.name}`} required maxLength="50" value={name} onChange={(event) => setName(event.target.value)} />
    <label className="color-field" title="Issue type color"><input aria-label={`Issue type color ${type.name}`} type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>{color}</span></label>
    <button className="button subtle" type="submit">Save</button>
    <button className="link-button danger-link" type="button" onClick={() => onDelete(type.id)}>Delete</button>
  </form>;
}

function WorkflowStatusEditor({ status, first, last, onSave, onDelete, onMove }) {
  const [name, setName] = useState(status.name);
  const [isDefault, setIsDefault] = useState(status.is_default);
  const [isFinal, setIsFinal] = useState(status.is_final);
  useEffect(() => { setName(status.name); setIsDefault(status.is_default); setIsFinal(status.is_final); }, [status]);
  return <form className="workflow-editor-row" onSubmit={(event) => { event.preventDefault(); onSave(status.id, { name, isDefault, isFinal }); }}>
    <div className="workflow-position"><button className="icon-button" aria-label={`Move ${status.name} up`} title="Move up" type="button" disabled={first} onClick={() => onMove(status.id, -1)}>↑</button><button className="icon-button" aria-label={`Move ${status.name} down`} title="Move down" type="button" disabled={last} onClick={() => onMove(status.id, 1)}>↓</button></div>
    <input aria-label={`Workflow status name ${status.name}`} required maxLength="50" value={name} onChange={(event) => setName(event.target.value)} />
    <label className="compact-choice"><input type="radio" name="default-workflow-status" checked={isDefault} onChange={() => setIsDefault(true)} /><span>Default</span></label>
    <label className="compact-choice"><input type="checkbox" checked={isFinal} onChange={(event) => setIsFinal(event.target.checked)} /><span>Completed</span></label>
    <button className="button subtle" type="submit">Save</button>
    <button className="link-button danger-link" type="button" onClick={() => onDelete(status.id)}>Delete</button>
  </form>;
}

function SpaceDetailsEditor({ project, onSave }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [enabledFeatures,setEnabledFeatures]=useState(project.enabled_features || ['summary','backlog','board','development','timeline','docs','forms']);
  useEffect(() => { setName(project.name); setDescription(project.description || ''); setEnabledFeatures(project.enabled_features || ['summary','backlog','board','development','timeline','docs','forms']); }, [project]);
  return <form className="panel space-details-panel" onSubmit={(event) => {
    event.preventDefault();
    onSave({ name, description: description.trim() || null, enabledFeatures });
  }}>
    <div><h2>Space details</h2><p className="muted">Rename this Space or update its description. The Space key stays unchanged so issue keys and links remain stable.</p></div>
    <div className="space-details-form">
      <label><span>Space name</span><input aria-label="Space name" required minLength="1" maxLength="200" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label><span>Space key</span><input aria-label="Space key" value={project.key} readOnly disabled /></label>
      <label className="space-description-field"><span>Description</span><textarea aria-label="Space description" maxLength="10000" rows="4" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <fieldset className="service-picker space-description-field"><legend>Space services</legend>{['backlog','development','timeline','docs','forms'].map((feature)=><label key={feature}><input type="checkbox" checked={enabledFeatures.includes(feature)} onChange={(event)=>setEnabledFeatures((current)=>event.target.checked?[...current,feature]:current.filter((item)=>item!==feature))}/><span>{feature}</span></label>)}<small>Summary and Board remain available for every Space.</small></fieldset>
    </div>
    <div className="settings-form-actions"><button className="button primary" type="submit">Save Space details</button></div>
  </form>;
}

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [types, setTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [projectResult, typeResult, statusResult, projects] = await Promise.all([
        projectApi.getProject(projectId), projectApi.listIssueTypes(projectId),
        projectApi.listWorkflowStatuses(projectId), projectApi.listProjects(),
      ]);
      setProject(projectResult.project); setTypes(typeResult.issueTypes); setStatuses(statusResult.workflowStatuses);
      setRole(projects.projects.find((item) => item.id === Number(projectId))?.project_role ?? 'viewer');
    } catch (requestError) { setError(requestError.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function submit(event, action) {
    event.preventDefault(); setError(''); setMessage('');
    try { await action(new FormData(event.currentTarget)); event.currentTarget.reset(); await load(); setMessage('Saved.'); }
    catch (requestError) { setError(requestError.message); }
  }
  async function mutate(action, successMessage = 'Saved.') {
    setError(''); setMessage('');
    try { await action(); await load(); setMessage(successMessage); }
    catch (requestError) { setError(requestError.message); }
  }
  async function moveStatus(statusId, direction) {
    const index = statuses.findIndex((status) => status.id === statusId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= statuses.length) return;
    const orderedIds = statuses.map((status) => status.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    await mutate(() => projectApi.reorderWorkflowStatuses(projectId, orderedIds), 'Workflow order updated.');
  }
  if (!project) return <div className="panel"><p>{error || 'Loading settings…'}</p></div>;
  if (role !== 'admin') return <div className="panel"><p className="alert error">Only Space administrators can manage settings.</p><Link to={`/projects/${projectId}/board`}>Back to board</Link></div>;
  return <div className="settings-page"><div className="section-heading"><div><p className="eyebrow">{project.key} · Space administration</p><h1>{project.name} settings</h1></div><Link className="button subtle" to={`/projects/${projectId}/board`}>Back to board</Link></div>{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}
    <section className="settings-grid">
      <SpaceDetailsEditor project={project} onSave={(changes) => mutate(async () => {
        const result = await projectApi.updateProject(projectId, changes);
        window.dispatchEvent(new CustomEvent('taskflow:space-updated', { detail: result.project }));
      }, 'Space details updated.')} />
      <div className="panel settings-config-panel"><h2>Issue types</h2><p className="muted">Create, rename, recolor, or remove the issue types used only by this Space.</p><form onSubmit={(event) => submit(event, (data) => projectApi.createIssueType(projectId, { name: data.get('name'), color: data.get('color') }))} className="settings-create-row"><input name="name" placeholder="Bug, Story…" maxLength="50" required /><input aria-label="New issue type color" name="color" type="color" defaultValue="#4f46e5" /><button className="button primary">Add type</button></form><div className="settings-editor-list">{types.map((type) => <IssueTypeEditor key={type.id} type={type} onSave={(id, changes) => mutate(() => projectApi.updateIssueType(projectId, id, changes), 'Issue type updated.')} onDelete={(id) => mutate(() => projectApi.deleteIssueType(projectId, id), 'Issue type deleted.')} />)}</div></div>
      <div className="panel settings-config-panel"><h2>Workflow statuses</h2><p className="muted">Rename and reorder columns, choose the default for new issues, and mark completed statuses.</p><form onSubmit={(event) => submit(event, (data) => projectApi.createWorkflowStatus(projectId, { name: data.get('name'), position: statuses.length, isDefault: data.has('isDefault'), isFinal: data.has('isFinal') }))} className="settings-create-row workflow-create-row"><input name="name" placeholder="In review" maxLength="50" required /><label className="compact-choice"><input name="isDefault" type="checkbox" /><span>Default</span></label><label className="compact-choice"><input name="isFinal" type="checkbox" /><span>Completed</span></label><button className="button primary">Add status</button></form><div className="settings-editor-list">{statuses.map((status, index) => <WorkflowStatusEditor key={status.id} status={status} first={index === 0} last={index === statuses.length - 1} onMove={moveStatus} onSave={(id, changes) => mutate(() => projectApi.updateWorkflowStatus(projectId, id, changes), 'Workflow status updated.')} onDelete={(id) => mutate(() => projectApi.deleteWorkflowStatus(projectId, id), 'Workflow status deleted.')} />)}</div></div>
    </section><p className="muted">Signed in as user #{user?.id}. Changes are restricted to administrators.</p></div>;
}
