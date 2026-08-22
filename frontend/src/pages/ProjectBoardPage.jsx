import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as issueApi from '../api/issue.api';
import * as projectApi from '../api/project.api';
import IssueForm from '../components/issue/IssueForm';
import StatusColumn from '../components/board/StatusColumn';
import RoleGuard from '../components/common/RoleGuard';
import useAuth from '../hooks/useAuth';
import usePolling from '../hooks/usePolling';
import { getProjectUpdates } from '../api/update.api';

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [role, setRole] = useState('viewer');
  const [statuses, setStatuses] = useState([]);
  const [types, setTypes] = useState([]);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [projectResult, statusResult, typeResult, issueResult, projectList] = await Promise.all([
        projectApi.getProject(projectId), projectApi.listWorkflowStatuses(projectId), projectApi.listIssueTypes(projectId), issueApi.listIssues(projectId, { page: 1, pageSize: 100 }), projectApi.listProjects(),
      ]);
      setProject(projectResult.project); setStatuses(statusResult.workflowStatuses); setTypes(typeResult.issueTypes); setIssues(issueResult.issues);
      setRole(projectList.projects.find((item) => item.id === Number(projectId))?.project_role ?? 'viewer');
    } catch (requestError) { setError(requestError.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const mergeUpdates = useCallback((updates) => {
    setIssues((current) => {
      const changed = new Map(current.map((issue) => [issue.id, issue]));
      updates.issues.forEach((issue) => changed.set(issue.id, issue));
      return [...changed.values()];
    });
  }, []);
  usePolling({ enabled: Boolean(project), fetchUpdates: (since) => getProjectUpdates(projectId, since), onUpdates: mergeUpdates });

  const grouped = useMemo(() => new Map(statuses.map((status) => [status.id, issues.filter((issue) => issue.status_id === status.id)])), [issues, statuses]);
  const canEdit = ['admin', 'member'].includes(role);
  async function createIssue(data) { await issueApi.createIssue(projectId, data); await load(); }
  async function changeStatus(issueKey, statusId) { await issueApi.updateIssueStatus(issueKey, statusId); await load(); }

  if (!project) return <div className="panel"><p>{error || 'Loading project…'}</p></div>;
  return <div className="board-page"><div className="section-heading"><div><p className="eyebrow">{project.key} · {role}</p><h1>{project.name}</h1><p className="muted">{project.description}</p></div><Link className="button subtle" to={`/projects/${projectId}/settings`}>Project settings</Link></div>{error && <p className="alert error">{error}</p>}<RoleGuard role={role} allow={['admin', 'member']}><section className="panel issue-create"><h2>Create issue</h2><IssueForm issueTypes={types} onSubmit={createIssue} submitLabel="Create issue" /></section></RoleGuard><div className="board-columns">{statuses.map((status) => <StatusColumn key={status.id} status={status} issues={grouped.get(status.id) ?? []} statuses={statuses} canEdit={canEdit} onStatusChange={changeStatus} />)}</div></div>;
}
