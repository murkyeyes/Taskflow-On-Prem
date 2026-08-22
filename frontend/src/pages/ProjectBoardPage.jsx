import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as issueApi from '../api/issue.api';
import * as projectApi from '../api/project.api';
import * as workspaceApi from '../api/workspace.api';
import StatusColumn from '../components/board/StatusColumn';
import RoleGuard from '../components/common/RoleGuard';
import usePolling from '../hooks/usePolling';
import { getProjectUpdates } from '../api/update.api';

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null); const [role, setRole] = useState('viewer');
  const [statuses, setStatuses] = useState([]); const [types, setTypes] = useState([]); const [issues, setIssues] = useState([]); const [assignees, setAssignees] = useState([]); const [sprints, setSprints] = useState([]);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [query, setQuery] = useState(''); const [assigneeId, setAssigneeId] = useState(''); const [priority, setPriority] = useState(''); const [statusId, setStatusId] = useState(''); const [groupBy, setGroupBy] = useState('status'); const [showFilters, setShowFilters] = useState(false); const [newColumn, setNewColumn] = useState('');

  const load = useCallback(async () => {
    try {
      const [projectResult, statusResult, typeResult, issueResult, projectList, assigneeResult, sprintResult] = await Promise.all([
        projectApi.getProject(projectId), projectApi.listWorkflowStatuses(projectId), projectApi.listIssueTypes(projectId), issueApi.listIssues(projectId, { page: 1, pageSize: 100, search: query }), projectApi.listProjects(), projectApi.listAssignees(projectId), workspaceApi.listSprints(projectId),
      ]);
      setProject(projectResult.project); setStatuses(statusResult.workflowStatuses); setTypes(typeResult.issueTypes); setIssues(issueResult.issues); setAssignees(assigneeResult.assignees); setSprints(sprintResult.sprints); setRole(projectList.projects.find((item) => item.id === Number(projectId))?.project_role ?? 'viewer');
    } catch (requestError) { setError(requestError.message); }
  }, [projectId, query]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);

  const mergeUpdates = useCallback((updates) => setIssues((current) => {
    const changed = new Map(current.map((issue) => [issue.id, issue])); updates.issues.forEach((issue) => changed.set(issue.id, issue)); return [...changed.values()];
  }), []);
  usePolling({ enabled: Boolean(project), fetchUpdates: (since) => getProjectUpdates(projectId, since), onUpdates: mergeUpdates });
  const canEdit = ['admin', 'member'].includes(role); const activeSprint = sprints.find((sprint) => sprint.status === 'active');
  const visibleIssues = useMemo(() => issues.filter((issue) => (!assigneeId || issue.assignee_id === Number(assigneeId)) && (!priority || issue.priority === priority) && (!statusId || issue.status_id === Number(statusId))), [assigneeId, issues, priority, statusId]);
  const columns = useMemo(() => {
    if (groupBy === 'status') return statuses.map((status) => ({ status, issues: visibleIssues.filter((issue) => issue.status_id === status.id) }));
    const labelFor = (issue) => groupBy === 'assignee' ? (assignees.find((member) => member.user_id === issue.assignee_id)?.name ?? 'Unassigned') : issue.priority;
    return [...new Set(visibleIssues.map(labelFor))].map((name) => ({ status: { id: -1, name }, issues: visibleIssues.filter((issue) => labelFor(issue) === name) }));
  }, [assignees, groupBy, statuses, visibleIssues]);
  async function createIssue(data) { setError(''); try { await issueApi.createIssue(projectId, data); await load(); setMessage('Issue created.'); } catch (requestError) { setError(requestError.message); throw requestError; } }
  async function changeStatus(issueKey, nextStatusId) { await issueApi.updateIssueStatus(issueKey, nextStatusId); await load(); }
  async function completeSprint() { if (!activeSprint) return; setError(''); try { const result = await workspaceApi.completeSprint(projectId, activeSprint.id); setMessage(`${result.sprint.name} completed; ${result.movedIssueCount} incomplete issue(s) returned to backlog.`); await load(); } catch (requestError) { setError(requestError.message); } }
  async function addColumn(event) { event.preventDefault(); if (!newColumn.trim()) return; try { await projectApi.createWorkflowStatus(projectId, { name: newColumn.trim(), position: statuses.length }); setNewColumn(''); await load(); setMessage('Workflow column added.'); } catch (requestError) { setError(requestError.message); } }
  if (!project) return <div className="panel"><p>{error || 'Loading project…'}</p></div>;
  return <div className="board-page"><div className="section-heading"><div><p className="eyebrow">{project.key} · {role}</p><h1>{project.name}</h1><p className="muted">{project.description}</p></div><Link className="button subtle" to={`/projects/${projectId}/settings`}>Project settings</Link></div>{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}
    <section className="board-toolbar panel"><input aria-label="Search board" placeholder="Search board" value={query} onChange={(event) => setQuery(event.target.value)} /><label>Assignee<select aria-label="Filter assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Everyone</option>{assignees.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}</select></label><button className="button subtle" type="button" onClick={() => setShowFilters((value) => !value)}>Filter</button><label>Group<select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="status">Status</option><option value="assignee">Assignee</option><option value="priority">Priority</option></select></label><span className="toolbar-spacer" /><button className="button primary" type="button" disabled={!canEdit || !activeSprint} title={activeSprint ? `Complete ${activeSprint.name}` : 'No active sprint'} onClick={completeSprint}>Complete sprint</button></section>
    {showFilters && <section className="panel board-filters"><label>Status<select value={statusId} onChange={(event) => setStatusId(event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{['lowest', 'low', 'medium', 'high', 'highest'].map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" className="button subtle" onClick={() => { setAssigneeId(''); setPriority(''); setStatusId(''); }}>Clear filters</button></section>}
    <div className="board-columns">{columns.map(({ status, issues: columnIssues }) => <StatusColumn key={`${groupBy}-${status.name}`} status={status} issues={columnIssues} statuses={statuses} canEdit={canEdit && groupBy === 'status'} issueTypes={types} assignees={assignees} onCreate={createIssue} onStatusChange={changeStatus} />)}<RoleGuard role={role} allow={['admin']}><section className="status-column add-column"><h2>Add column</h2><form className="stack-form" onSubmit={addColumn}><input aria-label="New workflow column" placeholder="Column name" value={newColumn} onChange={(event) => setNewColumn(event.target.value)} /><button className="button subtle">Add workflow status</button></form></section></RoleGuard></div>
  </div>;
}
