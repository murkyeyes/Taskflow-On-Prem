import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import * as issueApi from '../api/issue.api';
import * as projectApi from '../api/project.api';
import * as workspaceApi from '../api/workspace.api';
import StatusColumn from '../components/board/StatusColumn';
import RoleGuard from '../components/common/RoleGuard';
import usePolling from '../hooks/usePolling';
import { getProjectUpdates } from '../api/update.api';
import useAuth from '../hooks/useAuth';
import { useLocale } from '../contexts/LocaleContext';
import { filterAssigneeSuggestions, filterIssuesByMonth, formatMonth, loadAllIssuePages, normalizeMonthKey } from '../utils/monthlyBacklog';

const ISSUE_PAGE_SIZE = 100;

async function listAllIssues(projectId, filters) {
  return loadAllIssuePages(
    (page, pageSize) => issueApi.listIssues(projectId, { ...filters, page, pageSize }),
    ISSUE_PAGE_SIZE,
  );
}

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { locale } = useLocale();
  const selectedMonth = normalizeMonthKey(searchParams.get('month'));
  const [project, setProject] = useState(null); const [role, setRole] = useState('viewer');
  const [statuses, setStatuses] = useState([]); const [types, setTypes] = useState([]); const [issues, setIssues] = useState([]); const [assignees, setAssignees] = useState([]); const [sprints, setSprints] = useState([]);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [query, setQuery] = useState(''); const [assigneeIds, setAssigneeIds] = useState([]); const [draftAssigneeIds, setDraftAssigneeIds] = useState([]); const [assigneeSearch, setAssigneeSearch] = useState(''); const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false); const [priority, setPriority] = useState(''); const [statusId, setStatusId] = useState(''); const [createdOn, setCreatedOn] = useState(''); const [completedOn, setCompletedOn] = useState(''); const [groupBy, setGroupBy] = useState('status'); const [showFilters, setShowFilters] = useState(false); const [newColumn, setNewColumn] = useState('');

  const load = useCallback(async () => {
    try {
      const [projectResult, statusResult, typeResult, issueResult, projectList, assigneeResult, sprintResult] = await Promise.all([
        projectApi.getProject(projectId), projectApi.listWorkflowStatuses(projectId), projectApi.listIssueTypes(projectId), listAllIssues(projectId, { search: query, created_on: createdOn, completed_on: completedOn }), projectApi.listProjects(), projectApi.listAssignees(projectId), workspaceApi.listSprints(projectId),
      ]);
      setProject(projectResult.project); setStatuses(statusResult.workflowStatuses); setTypes(typeResult.issueTypes); setIssues(issueResult); setAssignees(assigneeResult.assignees); setSprints(sprintResult.sprints); setRole(projectList.projects.find((item) => item.id === Number(projectId))?.project_role ?? 'viewer');
    } catch (requestError) { setError(requestError.message); }
  }, [completedOn, createdOn, projectId, query]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);

  const mergeUpdates = useCallback((updates) => setIssues((current) => {
    const changed = new Map(current.map((issue) => [issue.id, issue])); updates.issues.forEach((issue) => changed.set(issue.id, issue)); return [...changed.values()];
  }), []);
  usePolling({ enabled: Boolean(project), fetchUpdates: (since) => getProjectUpdates(projectId, since), onUpdates: mergeUpdates });
  const canEdit = ['admin', 'member'].includes(role); const activeSprint = sprints.find((sprint) => sprint.status === 'active');
  const issueAssignees = useMemo(() => role === 'admin' ? assignees : assignees.filter((member) => member.user_id === user?.id), [assignees, role, user?.id]);
  const monthIssues = useMemo(() => filterIssuesByMonth(issues, selectedMonth), [issues, selectedMonth]);
  const assigneeOptions = useMemo(() => [
    ...(monthIssues.some((issue) => issue.assignee_id == null) ? [{ value: 'unassigned', name: locale === 'vi' ? 'Chưa giao' : 'Unassigned' }] : []),
    ...assignees.map((member) => ({ value: String(member.user_id), name: member.name })),
  ], [assignees, locale, monthIssues]);
  const allAssigneeIds = useMemo(() => assigneeOptions.map(({ value }) => value), [assigneeOptions]);
  const matchingAssignees = useMemo(() => filterAssigneeSuggestions(assigneeOptions, assigneeSearch), [assigneeOptions, assigneeSearch]);
  const visibleIssues = useMemo(() => monthIssues.filter((issue) => {
    const issueAssignee = issue.assignee_id == null ? 'unassigned' : String(issue.assignee_id);
    return (!assigneeIds.length || assigneeIds.includes(issueAssignee))
      && (!priority || issue.priority === priority)
      && (!statusId || issue.status_id === Number(statusId));
  }), [assigneeIds, monthIssues, priority, statusId]);

  useEffect(() => {
    if (!assigneeMenuOpen) setDraftAssigneeIds(assigneeIds.length ? assigneeIds : allAssigneeIds);
  }, [allAssigneeIds, assigneeIds, assigneeMenuOpen]);
  useEffect(() => {
    setAssigneeIds((current) => current.filter((value) => allAssigneeIds.includes(value)));
  }, [allAssigneeIds]);

  const columns = useMemo(() => {
    if (groupBy === 'status') return statuses.map((status) => ({ status, issues: visibleIssues.filter((issue) => issue.status_id === status.id) }));
    const labelFor = (issue) => groupBy === 'assignee' ? (assignees.find((member) => member.user_id === issue.assignee_id)?.name ?? 'Unassigned') : issue.priority;
    return [...new Set(visibleIssues.map(labelFor))].map((name) => ({ status: { id: -1, name }, issues: visibleIssues.filter((issue) => labelFor(issue) === name) }));
  }, [assignees, groupBy, statuses, visibleIssues]);
  function openAssigneeMenu() { setDraftAssigneeIds(assigneeIds.length ? assigneeIds : allAssigneeIds); setAssigneeSearch(''); setAssigneeMenuOpen(true); }
  function dismissAssigneeMenu() { setDraftAssigneeIds(assigneeIds.length ? assigneeIds : allAssigneeIds); setAssigneeSearch(''); setAssigneeMenuOpen(false); }
  function toggleDraftAssignee(value) { setDraftAssigneeIds((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]); }
  function toggleAllAssignees() { setDraftAssigneeIds(draftAssigneeIds.length === allAssigneeIds.length ? [] : allAssigneeIds); }
  function applyAssigneeFilter() { setAssigneeIds(draftAssigneeIds.length === allAssigneeIds.length ? [] : draftAssigneeIds); setAssigneeSearch(''); setAssigneeMenuOpen(false); }
  async function createIssue(data) { setError(''); try { await issueApi.createIssue(projectId, data); await load(); setMessage('Issue created.'); } catch (requestError) { setError(requestError.message); throw requestError; } }
  async function changeStatus(issueKey, nextStatusId) { setError(''); try { await issueApi.updateIssueStatus(issueKey, nextStatusId); await load(); } catch (requestError) { setError(requestError.message); } }
  async function completeSprint() { if (!activeSprint) return; setError(''); try { const result = await workspaceApi.completeSprint(projectId, activeSprint.id); setMessage(`${result.sprint.name} completed; ${result.movedIssueCount} incomplete issue(s) returned to backlog.`); await load(); } catch (requestError) { setError(requestError.message); } }
  async function addColumn(event) { event.preventDefault(); if (!newColumn.trim()) return; try { await projectApi.createWorkflowStatus(projectId, { name: newColumn.trim(), position: statuses.length }); setNewColumn(''); await load(); setMessage('Workflow column added.'); } catch (requestError) { setError(requestError.message); } }
  if (!project) return <div className="panel"><p>{error || 'Loading project…'}</p></div>;
  return <div className="board-page"><div className="section-heading"><div><p className="eyebrow">{project.key} · {role}</p><h1>{project.name}</h1><p className="muted">{project.description}</p></div><Link className="button subtle" to={`/projects/${projectId}/settings`}>Space settings</Link></div>{error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}
    {selectedMonth && <section className="monthly-board-banner panel">
      <div><span className="monthly-report-icon" aria-hidden="true">▣</span><span><small>Monthly report</small><strong>{formatMonth(selectedMonth, locale)}</strong></span></div>
      <Link to={`/projects/${projectId}/backlog`}>← Monthly Backlog</Link>
    </section>}
    <section className="board-toolbar panel">
      <input aria-label="Search board" placeholder="Search board" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="report-person-picker board-person-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) dismissAssigneeMenu(); }}>
        <label htmlFor="board-assignee-search">Assignee</label>
        <span className="report-person-input">
          <span aria-hidden="true">⌕</span>
          <input
            id="board-assignee-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="board-assignee-options"
            aria-expanded={assigneeMenuOpen}
            placeholder={assigneeIds.length
              ? `${assigneeIds.length} ${locale === 'vi' ? 'người đã chọn' : assigneeIds.length === 1 ? 'person selected' : 'people selected'}`
              : (locale === 'vi' ? 'Mọi người — tìm theo tên' : 'Everyone — search by name')}
            value={assigneeSearch}
            onFocus={openAssigneeMenu}
            onChange={(event) => setAssigneeSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') dismissAssigneeMenu();
              if (event.key === 'Enter' && assigneeMenuOpen) { event.preventDefault(); applyAssigneeFilter(); }
            }}
          />
          <button type="button" aria-label="Open assignee checklist" onClick={() => (assigneeMenuOpen ? dismissAssigneeMenu() : openAssigneeMenu())}>⌄</button>
        </span>
        {assigneeMenuOpen && <div className="report-person-suggestions report-person-checklist" id="board-assignee-options" role="group" aria-label="Select assignees">
          <label className="report-select-all">
            <input type="checkbox" checked={allAssigneeIds.length > 0 && draftAssigneeIds.length === allAssigneeIds.length} onChange={toggleAllAssignees} />
            <strong>{locale === 'vi' ? '(Chọn tất cả)' : '(Select All)'}</strong>
          </label>
          <div className="report-person-option-list">
            {matchingAssignees.map((option) => <label key={option.value}>
              <input type="checkbox" checked={draftAssigneeIds.includes(option.value)} onChange={() => toggleDraftAssignee(option.value)} />
              <span className="avatar-mini">{option.value === 'unassigned' ? '?' : option.name.slice(0, 1).toUpperCase()}</span>
              <span>{option.name}</span>
            </label>)}
          </div>
          {!matchingAssignees.length && <p>No matching people.</p>}
          <footer>
            <button type="button" className="button primary" onClick={applyAssigneeFilter}>{locale === 'vi' ? 'Áp dụng' : 'Apply'}</button>
            <button type="button" className="button subtle" onClick={dismissAssigneeMenu}>{locale === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </footer>
        </div>}
      </div>
      <button className="button subtle" type="button" onClick={() => setShowFilters((value) => !value)}>Filter</button>
      <label>Group<select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="status">Status</option><option value="assignee">Assignee</option><option value="priority">Priority</option></select></label>
      <span className="toolbar-spacer" />
      <button className="button primary" type="button" disabled={!canEdit || !activeSprint} title={activeSprint ? `Complete ${activeSprint.name}` : 'No active sprint'} onClick={completeSprint}>Complete sprint</button>
    </section>
    {showFilters && <section className="panel board-filters"><label>Status<select value={statusId} onChange={(event) => setStatusId(event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{['lowest', 'low', 'medium', 'high', 'highest'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Created on<input type="date" value={createdOn} onChange={(event) => setCreatedOn(event.target.value)} /></label><label>Completed on<input type="date" value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} /></label><button type="button" className="button subtle" onClick={() => { setAssigneeIds([]); setDraftAssigneeIds(allAssigneeIds); setAssigneeSearch(''); setAssigneeMenuOpen(false); setPriority(''); setStatusId(''); setCreatedOn(''); setCompletedOn(''); }}>Clear filters</button></section>}
    <div className="board-columns">{columns.map(({ status, issues: columnIssues }) => <StatusColumn key={`${groupBy}-${status.name}`} status={status} issues={columnIssues} statuses={statuses} canEdit={canEdit && groupBy === 'status'} canEditCompleted={role === 'admin'} issueTypes={types} assignees={issueAssignees} restrictAssigneeToUserId={role === 'admin' ? null : user?.id} onCreate={createIssue} onStatusChange={changeStatus} />)}<RoleGuard role={role} allow={['admin']}><section className="status-column add-column"><h2>Add column</h2><form className="stack-form" onSubmit={addColumn}><input aria-label="New workflow column" placeholder="Column name" value={newColumn} onChange={(event) => setNewColumn(event.target.value)} /><button className="button subtle">Add workflow status</button></form></section></RoleGuard></div>
  </div>;
}
