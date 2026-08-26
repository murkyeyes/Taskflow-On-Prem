import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';

import * as issueApi from '../api/issue.api';
import * as projectApi from '../api/project.api';
import { useLocale } from '../contexts/LocaleContext';
import {
  availableReportYears,
  buildMonthlyArchive,
  daysInReportMonth,
  filterIssuesByMonth,
  filterReportIssues,
  formatCreatedDate,
  formatMonth,
  loadAllIssuePages,
  normalizeReportDay,
  normalizeReportMonth,
  normalizeReportYear,
  reportDayFor,
} from '../utils/monthlyBacklog';

const ISSUE_PAGE_SIZE = 100;

async function listAllIssues(projectId) {
  return loadAllIssuePages((page, pageSize) => issueApi.listIssues(projectId, { page, pageSize }), ISSUE_PAGE_SIZE);
}

export default function ProjectBacklogPage() {
  const { project } = useOutletContext();
  const { locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const monthScroller = useRef(null);
  const calendarHeaderScroller = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allIssues, statusResult] = await Promise.all([
        listAllIssues(project.id),
        projectApi.listWorkflowStatuses(project.id),
      ]);
      setIssues(allIssues);
      setStatuses(statusResult.workflowStatuses);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const archive = useMemo(() => buildMonthlyArchive(issues), [issues]);
  const years = useMemo(() => availableReportYears(issues), [issues]);
  const activeYear = normalizeReportYear(searchParams.get('year'), years);
  const latestMonthInYear = Number(archive.find(({ key }) => key.startsWith(`${activeYear}-`))?.key.slice(5)) || 1;
  const activeMonth = normalizeReportMonth(searchParams.get('month'), latestMonthInYear);
  const activeMonthKey = `${activeYear}-${String(activeMonth).padStart(2, '0')}`;
  const monthCounts = useMemo(() => new Map(archive.map(({ key, count }) => [key, count])), [archive]);
  const monthlyIssues = useMemo(
    () => filterIssuesByMonth(issues, activeMonthKey).sort((left, right) => new Date(left.created_at) - new Date(right.created_at)),
    [activeMonthKey, issues],
  );
  const days = useMemo(() => daysInReportMonth(activeYear, activeMonth, locale), [activeMonth, activeYear, locale]);
  const activeDay = normalizeReportDay(searchParams.get('day'), days.length);
  const assigneeOptions = useMemo(() => {
    const names = new Map();
    monthlyIssues.forEach((issue) => {
      if (issue.assignee_id != null) names.set(issue.assignee_id, issue.assignee_name || `User #${issue.assignee_id}`);
    });
    return [...names.entries()].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [monthlyIssues]);
  const hasUnassigned = monthlyIssues.some((issue) => issue.assignee_id == null);
  const requestedAssignee = searchParams.get('assignee') ?? '';
  const selectedAssignee = requestedAssignee === 'unassigned'
    ? (hasUnassigned ? requestedAssignee : '')
    : (assigneeOptions.some(({ id }) => String(id) === requestedAssignee) ? requestedAssignee : '');
  const requestedStatus = searchParams.get('status') ?? '';
  const selectedStatus = statuses.some(({ id }) => String(id) === requestedStatus) ? requestedStatus : '';
  const visibleIssues = useMemo(
    () => filterReportIssues(monthlyIssues, { day: activeDay, assignee: selectedAssignee, status: selectedStatus }),
    [activeDay, monthlyIssues, selectedAssignee, selectedStatus],
  );
  const statusById = useMemo(() => new Map(statuses.map((status) => [status.id, status])), [statuses]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short' }), [locale]);

  function selectPeriod(year, month) {
    setSearchParams({ year: String(year), month: String(month) });
  }

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    next.set('year', String(activeYear));
    next.set('month', String(activeMonth));
    if (value) next.set(name, String(value)); else next.delete(name);
    setSearchParams(next);
  }

  function toggleDay(day) {
    updateFilter('day', activeDay === day ? '' : day);
  }

  function clearFilters() {
    setSearchParams({ year: String(activeYear), month: String(activeMonth) });
  }

  function selectYear(event) {
    const year = Number(event.target.value);
    const latest = Number(archive.find(({ key }) => key.startsWith(`${year}-`))?.key.slice(5)) || 1;
    selectPeriod(year, latest);
  }

  function scrollMonths(direction) {
    monthScroller.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
  }

  function syncCalendarHeader(event) {
    if (calendarHeaderScroller.current) calendarHeaderScroller.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  return <div className="report-backlog-page">
    <div className="view-heading report-backlog-heading">
      <div>
        <h2>Monthly Backlog</h2>
        <p>Review reporting tasks by Space, assignee, and calendar day.</p>
      </div>
      <label className="report-year-field">
        <span>Report year</span>
        <select value={activeYear} onChange={selectYear}>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
    </div>
    {error && <p className="alert error">{error}</p>}

    <section className="report-month-navigation panel" aria-label="Report months">
      <button type="button" aria-label="Previous months" onClick={() => scrollMonths(-1)}>‹</button>
      <div className="report-month-strip" ref={monthScroller}>
        {Array.from({ length: 12 }, (_, index) => {
          const month = index + 1;
          const key = `${activeYear}-${String(month).padStart(2, '0')}`;
          const count = monthCounts.get(key) ?? 0;
          return <button type="button" className={month === activeMonth ? 'active' : ''} key={month} onClick={() => selectPeriod(activeYear, month)}>
            <strong>{monthFormatter.format(new Date(activeYear, index, 1))}</strong>
            <small>{count} {locale === 'vi' ? 'báo cáo' : count === 1 ? 'report' : 'reports'}</small>
          </button>;
        })}
      </div>
      <button type="button" aria-label="Next months" onClick={() => scrollMonths(1)}>›</button>
    </section>

    <section className="report-filter-bar panel" aria-label="Report filters">
      <label>
        <span>Person</span>
        <select value={selectedAssignee} onChange={(event) => updateFilter('assignee', event.target.value)}>
          <option value="">Everyone</option>
          {hasUnassigned && <option value="unassigned">Unassigned</option>}
          {assigneeOptions.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select value={selectedStatus} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
        </select>
      </label>
      <div className="report-active-day">
        <span>Report day</span>
        <strong>{activeDay ? `${activeDay}/${activeMonth}/${activeYear}` : 'All days'}</strong>
      </div>
      <button type="button" className="button subtle" disabled={!activeDay && !selectedAssignee && !selectedStatus} onClick={clearFilters}>Clear filters</button>
    </section>

    {loading && <p className="empty-row">Loading…</p>}
    {!loading && <section className="report-calendar-card">
      <header className="report-calendar-title">
        <strong>{formatMonth(activeMonthKey, locale)}</strong>
        <span>{visibleIssues.length} {locale === 'vi' ? 'báo cáo' : visibleIssues.length === 1 ? 'report' : 'reports'}</span>
      </header>
      <div className="report-calendar-header-scroll" ref={calendarHeaderScroller}>
        <div className="report-calendar-header-grid" role="row" style={{ '--report-days': days.length, '--report-width': `${590 + (days.length * 42)}px` }}>
          <div className="report-grid-header report-task-column" role="columnheader">Report task</div>
          <div className="report-grid-header report-assignee-column" role="columnheader">Assignee</div>
          <div className="report-grid-header report-status-column" role="columnheader">Status</div>
          {days.map(({ day, weekday }) => <button className={`report-grid-day-header ${activeDay === day ? 'active' : ''}`} type="button" role="columnheader" aria-pressed={activeDay === day} aria-label={`Filter reports for ${day}/${activeMonth}/${activeYear}`} onClick={() => toggleDay(day)} key={day}><strong>{day}</strong><small>{weekday}</small></button>)}
        </div>
      </div>

      <button className="report-space-row" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span>{expanded ? '⌄' : '›'}</span>
        <span className="project-avatar">{project.key.slice(0, 1)}</span>
        <strong>{project.name}</strong>
        <small>{visibleIssues.length}</small>
      </button>

      {expanded && <div className="report-calendar-body-scroll" onScroll={syncCalendarHeader}>
        <div className="report-calendar-body-grid" role="table" style={{ '--report-days': days.length, '--report-width': `${590 + (days.length * 42)}px` }}>
          {expanded && visibleIssues.map((issue) => {
            const reportDay = reportDayFor(issue.created_at);
            const status = statusById.get(issue.status_id);
            return <div className="report-issue-row" role="row" key={issue.id}>
              <div className="report-task-cell report-task-column" role="cell">
                <Link to={`/issues/${issue.issue_key}`}><small>{issue.issue_key}</small><strong>{issue.title}</strong></Link>
              </div>
              <div className="report-assignee-cell report-assignee-column" role="cell">
                <span className="avatar-mini">{(issue.assignee_name || '?').slice(0, 1).toUpperCase()}</span>
                <span>{issue.assignee_name || 'Unassigned'}</span>
              </div>
              <div className="report-status-cell report-status-column" role="cell">
                <span className={issue.completed_at ? 'completed' : ''}>{status?.name || 'Unknown'}</span>
              </div>
              {days.map(({ day }) => <div className={`report-day-cell ${day === reportDay ? 'has-report' : ''}`} role="cell" key={day}>
                {day === reportDay && <Link to={`/issues/${issue.issue_key}`} aria-label={`Open ${issue.issue_key} report for ${formatCreatedDate(issue.created_at, locale)}`} title={formatCreatedDate(issue.created_at, locale)}>{locale === 'vi' ? 'Xem ↗' : 'View ↗'}</Link>}
              </div>)}
            </div>;
          })}
          {expanded && visibleIssues.length === 0 && <div className="report-calendar-empty">No reports for this month.</div>}
        </div>
      </div>}
    </section>}
  </div>;
}
