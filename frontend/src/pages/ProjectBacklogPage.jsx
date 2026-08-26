import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';

import * as issueApi from '../api/issue.api';
import * as projectApi from '../api/project.api';
import { useLocale } from '../contexts/LocaleContext';
import {
  availableReportYears,
  buildMonthlyArchive,
  daysInReportMonth,
  filterAssigneeSuggestions,
  filterIssuesByMonth,
  filterReportIssues,
  formatCreatedDate,
  formatMonth,
  loadAllIssuePages,
  normalizeAssigneeFilter,
  normalizeReportDay,
  normalizeReportMonth,
  normalizeReportYear,
  normalizeTaskFilter,
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
  const [personSearch, setPersonSearch] = useState('');
  const [personMenuOpen, setPersonMenuOpen] = useState(false);
  const [draftAssignees, setDraftAssignees] = useState([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [draftTasks, setDraftTasks] = useState([]);
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
  const requestedAssignees = searchParams.get('assignee') ?? '';
  const selectedAssignees = useMemo(
    () => normalizeAssigneeFilter(requestedAssignees, assigneeOptions, hasUnassigned),
    [assigneeOptions, hasUnassigned, requestedAssignees],
  );
  const taskOptions = useMemo(() => monthlyIssues.map((issue) => ({ value: String(issue.id), name: issue.title, issueKey: issue.issue_key })), [monthlyIssues]);
  const allTaskValues = useMemo(() => taskOptions.map(({ value }) => value), [taskOptions]);
  const requestedTasks = searchParams.get('task') ?? '';
  const selectedTasks = useMemo(() => normalizeTaskFilter(requestedTasks, monthlyIssues), [monthlyIssues, requestedTasks]);
  const requestedStatus = searchParams.get('status') ?? '';
  const selectedStatus = statuses.some(({ id }) => String(id) === requestedStatus) ? requestedStatus : '';
  const assigneeSuggestions = useMemo(() => [
    ...(hasUnassigned ? [{ value: 'unassigned', name: locale === 'vi' ? 'Chưa giao' : 'Unassigned' }] : []),
    ...assigneeOptions.map(({ id, name }) => ({ value: String(id), name })),
  ], [assigneeOptions, hasUnassigned, locale]);
  const allAssigneeValues = useMemo(() => assigneeSuggestions.map(({ value }) => value), [assigneeSuggestions]);
  const matchingAssignees = useMemo(
    () => filterAssigneeSuggestions(assigneeSuggestions, personSearch),
    [assigneeSuggestions, personSearch],
  );
  const matchingTasks = useMemo(
    () => filterAssigneeSuggestions(taskOptions, taskSearch),
    [taskOptions, taskSearch],
  );
  const visibleIssues = useMemo(
    () => filterReportIssues(monthlyIssues, { day: activeDay, assignees: selectedAssignees, status: selectedStatus, tasks: selectedTasks }),
    [activeDay, monthlyIssues, selectedAssignees, selectedStatus, selectedTasks],
  );
  const statusById = useMemo(() => new Map(statuses.map((status) => [status.id, status])), [statuses]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short' }), [locale]);

  useEffect(() => {
    if (!personMenuOpen) setDraftAssignees(selectedAssignees.length ? selectedAssignees : allAssigneeValues);
  }, [allAssigneeValues, personMenuOpen, selectedAssignees]);
  useEffect(() => {
    if (!taskMenuOpen) setDraftTasks(selectedTasks.length ? selectedTasks : allTaskValues);
  }, [allTaskValues, selectedTasks, taskMenuOpen]);

  function selectPeriod(year, month) {
    setPersonSearch('');
    setPersonMenuOpen(false);
    setTaskSearch('');
    setTaskMenuOpen(false);
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
    setPersonSearch('');
    setPersonMenuOpen(false);
    setTaskSearch('');
    setTaskMenuOpen(false);
    setSearchParams({ year: String(activeYear), month: String(activeMonth) });
  }

  function openPersonMenu() {
    setDraftAssignees(selectedAssignees.length ? selectedAssignees : allAssigneeValues);
    setPersonSearch('');
    setPersonMenuOpen(true);
    setTaskMenuOpen(false);
  }

  function dismissPersonMenu() {
    setDraftAssignees(selectedAssignees.length ? selectedAssignees : allAssigneeValues);
    setPersonSearch('');
    setPersonMenuOpen(false);
  }

  function toggleDraftAssignee(value) {
    setDraftAssignees((current) => current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]);
  }

  function toggleAllAssignees() {
    setDraftAssignees(draftAssignees.length === allAssigneeValues.length ? [] : allAssigneeValues);
  }

  function applyAssigneeFilter() {
    updateFilter('assignee', draftAssignees.length === allAssigneeValues.length ? '' : draftAssignees.join(','));
    setPersonSearch('');
    setPersonMenuOpen(false);
  }

  function openTaskMenu() {
    setDraftTasks(selectedTasks.length ? selectedTasks : allTaskValues);
    setTaskSearch('');
    setTaskMenuOpen(true);
    setPersonMenuOpen(false);
  }

  function dismissTaskMenu() {
    setDraftTasks(selectedTasks.length ? selectedTasks : allTaskValues);
    setTaskSearch('');
    setTaskMenuOpen(false);
  }

  function toggleDraftTask(value) {
    setDraftTasks((current) => current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]);
  }

  function toggleAllTasks() {
    setDraftTasks(draftTasks.length === allTaskValues.length ? [] : allTaskValues);
  }

  function applyTaskFilter() {
    updateFilter('task', draftTasks.length === allTaskValues.length ? '' : draftTasks.join(','));
    setTaskSearch('');
    setTaskMenuOpen(false);
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
      <div className="report-person-picker report-task-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) dismissTaskMenu(); }}>
        <label htmlFor="report-task-search">Task</label>
        <span className="report-person-input">
          <span aria-hidden="true">⌕</span>
          <input
            id="report-task-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="report-task-suggestions"
            aria-expanded={taskMenuOpen}
            placeholder={selectedTasks.length
              ? `${selectedTasks.length} ${locale === 'vi' ? 'công việc đã chọn' : selectedTasks.length === 1 ? 'task selected' : 'tasks selected'}`
              : (locale === 'vi' ? 'Tất cả công việc — tìm theo tên' : 'All tasks — search by name')}
            value={taskSearch}
            onFocus={openTaskMenu}
            onChange={(event) => setTaskSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') dismissTaskMenu();
              if (event.key === 'Enter' && taskMenuOpen) { event.preventDefault(); applyTaskFilter(); }
            }}
          />
          <button type="button" aria-label="Open task checklist" onClick={() => (taskMenuOpen ? dismissTaskMenu() : openTaskMenu())}>⌄</button>
        </span>
        {taskMenuOpen && <div className="report-person-suggestions report-person-checklist" id="report-task-suggestions" role="group" aria-label="Select tasks">
          <label className="report-select-all">
            <input type="checkbox" checked={allTaskValues.length > 0 && draftTasks.length === allTaskValues.length} onChange={toggleAllTasks} />
            <strong>{locale === 'vi' ? '(Chọn tất cả)' : '(Select All)'}</strong>
          </label>
          <div className="report-person-option-list report-task-option-list">
            {matchingTasks.map((option) => <label key={option.value}>
              <input type="checkbox" checked={draftTasks.includes(option.value)} onChange={() => toggleDraftTask(option.value)} />
              <span className="report-task-option-icon" aria-hidden="true">▣</span>
              <span><small>{option.issueKey}</small><strong>{option.name}</strong></span>
            </label>)}
          </div>
          {!matchingTasks.length && <p>{locale === 'vi' ? 'Không tìm thấy công việc.' : 'No matching tasks.'}</p>}
          <footer>
            <button type="button" className="button primary" onClick={applyTaskFilter}>{locale === 'vi' ? 'Áp dụng' : 'Apply'}</button>
            <button type="button" className="button subtle" onClick={dismissTaskMenu}>{locale === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </footer>
        </div>}
      </div>
      <div className="report-person-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) dismissPersonMenu(); }}>
        <label htmlFor="report-person-search">Person</label>
        <span className="report-person-input">
          <span aria-hidden="true">⌕</span>
          <input
            id="report-person-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="report-person-suggestions"
            aria-expanded={personMenuOpen}
            placeholder={selectedAssignees.length
              ? `${selectedAssignees.length} ${locale === 'vi' ? 'người đã chọn' : selectedAssignees.length === 1 ? 'person selected' : 'people selected'}`
              : (locale === 'vi' ? 'Mọi người — tìm theo tên' : 'Everyone — search by name')}
            value={personSearch}
            onFocus={openPersonMenu}
            onChange={(event) => {
              setPersonSearch(event.target.value);
              if (!personMenuOpen) openPersonMenu();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') dismissPersonMenu();
              if (event.key === 'Enter' && personMenuOpen) {
                event.preventDefault();
                applyAssigneeFilter();
              }
            }}
          />
          <button type="button" aria-label="Open person checklist" onClick={() => (personMenuOpen ? dismissPersonMenu() : openPersonMenu())}>⌄</button>
        </span>
        {personMenuOpen && <div className="report-person-suggestions report-person-checklist" id="report-person-suggestions" role="group" aria-label="Select people">
          <label className="report-select-all">
            <input type="checkbox" checked={allAssigneeValues.length > 0 && draftAssignees.length === allAssigneeValues.length} onChange={toggleAllAssignees} />
            <strong>{locale === 'vi' ? '(Chọn tất cả)' : '(Select All)'}</strong>
          </label>
          <div className="report-person-option-list">
            {matchingAssignees.map((suggestion) => <label key={suggestion.value}>
              <input type="checkbox" checked={draftAssignees.includes(suggestion.value)} onChange={() => toggleDraftAssignee(suggestion.value)} />
              <span className="avatar-mini">{suggestion.value === 'unassigned' ? '?' : suggestion.name.slice(0, 1).toUpperCase()}</span>
              <span>{suggestion.name}</span>
            </label>)}
          </div>
          {!matchingAssignees.length && <p>No matching people.</p>}
          <footer>
            <button type="button" className="button primary" onClick={applyAssigneeFilter}>{locale === 'vi' ? 'Áp dụng' : 'Apply'}</button>
            <button type="button" className="button subtle" onClick={dismissPersonMenu}>{locale === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </footer>
        </div>}
      </div>
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
      <button type="button" className="button subtle" disabled={!activeDay && !selectedTasks.length && !selectedAssignees.length && !selectedStatus} onClick={clearFilters}>Clear filters</button>
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
