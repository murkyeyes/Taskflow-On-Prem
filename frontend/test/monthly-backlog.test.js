import assert from 'node:assert/strict';
import test from 'node:test';

import { availableReportYears, buildMonthlyArchive, daysInReportMonth, filterAssigneeSuggestions, filterIssuesByMonth, filterReportIssues, formatMonth, loadAllIssuePages, monthKeyFor, monthlyBoardPath, normalizeAssigneeFilter, normalizeMonthKey, normalizeReportDay, normalizeReportMonth, normalizeReportYear, normalizeTaskFilter, reportDayFor } from '../src/utils/monthlyBacklog.js';

const issues = [
  { id: 1, created_at: '2026-01-05T12:00:00.000Z' },
  { id: 2, created_at: '2026-01-31T12:00:00.000Z' },
  { id: 3, created_at: '2026-02-10T12:00:00.000Z' },
];

test('groups issues by creation month newest first', () => {
  assert.deepEqual(buildMonthlyArchive(issues), [
    { key: '2026-02', count: 1 },
    { key: '2026-01', count: 2 },
  ]);
});

test('opens only the selected monthly backlog', () => {
  assert.deepEqual(filterIssuesByMonth(issues, '2026-01').map(({ id }) => id), [1, 2]);
  assert.equal(filterIssuesByMonth(issues, 'all').length, 3);
});

test('formats stable month keys and localized labels', () => {
  assert.equal(monthKeyFor('2026-02-10T12:00:00.000Z'), '2026-02');
  assert.equal(monthKeyFor('not-a-date'), null);
  assert.match(formatMonth('2026-01', 'en'), /January 2026/);
  assert.match(formatMonth('2026-01', 'vi'), /tháng 1.*2026/i);
});

test('loads every API page before building the archive', async () => {
  const records = Array.from({ length: 205 }, (_, index) => ({ id: index + 1 }));
  const requestedPages = [];
  const result = await loadAllIssuePages(async (page, pageSize) => {
    requestedPages.push(page);
    const offset = (page - 1) * pageSize;
    return { issues: records.slice(offset, offset + pageSize), total: records.length };
  });
  assert.equal(result.length, 205);
  assert.deepEqual(requestedPages, [1, 2, 3]);
});

test('builds a safe monthly Kanban route and rejects malformed month keys', () => {
  assert.equal(normalizeMonthKey('2026-08'), '2026-08');
  assert.equal(normalizeMonthKey('2026-13'), null);
  assert.equal(normalizeMonthKey('all'), null);
  assert.equal(monthlyBoardPath(7, '2026-08'), '/projects/7/board?month=2026-08');
  assert.equal(monthlyBoardPath(7, 'not-a-month'), '/projects/7/board');
});

test('builds report years and validates year/month selections', () => {
  assert.deepEqual(availableReportYears(issues), [2026]);
  assert.deepEqual(availableReportYears([], 2030), [2030]);
  assert.equal(normalizeReportYear('2026', [2026, 2025]), 2026);
  assert.equal(normalizeReportYear('1999', [2026, 2025]), 2026);
  assert.equal(normalizeReportMonth('12', 8), 12);
  assert.equal(normalizeReportMonth('13', 8), 8);
});

test('builds the exact report-day calendar including leap years', () => {
  const days = daysInReportMonth(2024, 2, 'en');
  assert.equal(days.length, 29);
  assert.equal(days[0].day, 1);
  assert.equal(days[28].day, 29);
  assert.equal(reportDayFor('2026-08-24T12:00:00.000Z'), 24);
  assert.equal(reportDayFor('invalid'), null);
});

test('validates report days and composes day, assignee, and status filters', () => {
  const reports = [
    { id: 1, created_at: '2026-08-24T12:00:00.000Z', assignee_id: 7, status_id: 2 },
    { id: 2, created_at: '2026-08-24T14:00:00.000Z', assignee_id: null, status_id: 3 },
    { id: 3, created_at: '2026-08-25T12:00:00.000Z', assignee_id: 7, status_id: 3 },
  ];
  assert.equal(normalizeReportDay('24', 31), 24);
  assert.equal(normalizeReportDay('32', 31), null);
  assert.deepEqual(filterReportIssues(reports, { day: 24 }).map(({ id }) => id), [1, 2]);
  assert.deepEqual(filterReportIssues(reports, { assignee: 'unassigned' }).map(({ id }) => id), [2]);
  assert.deepEqual(filterReportIssues(reports, { day: 24, assignee: '7', status: '2' }).map(({ id }) => id), [1]);
});

test('searches assignee suggestions by name without case sensitivity', () => {
  const options = [
    { value: '7', name: 'Taskflow Member' },
    { value: '8', name: 'KHAI' },
    { value: '9', name: 'Sales Reporter' },
  ];
  assert.deepEqual(filterAssigneeSuggestions(options, 'task').map(({ value }) => value), ['7']);
  assert.deepEqual(filterAssigneeSuggestions(options, 'AI').map(({ value }) => value), ['8']);
  assert.equal(filterAssigneeSuggestions(options, '').length, 3);
});

test('validates and applies reload-safe multi-assignee checklist filters', () => {
  const options = [{ id: 7, name: 'Taskflow Member' }, { id: 8, name: 'KHAI' }];
  assert.deepEqual(normalizeAssigneeFilter('7,unassigned,7,invalid', options, true), ['7', 'unassigned']);
  assert.deepEqual(normalizeAssigneeFilter('7,unassigned', options, false), ['7']);
  const reports = [
    { id: 1, created_at: '2026-08-24T12:00:00.000Z', assignee_id: 7, status_id: 2 },
    { id: 2, created_at: '2026-08-24T14:00:00.000Z', assignee_id: null, status_id: 2 },
    { id: 3, created_at: '2026-08-24T16:00:00.000Z', assignee_id: 8, status_id: 2 },
  ];
  assert.deepEqual(filterReportIssues(reports, { assignees: ['7', 'unassigned'] }).map(({ id }) => id), [1, 2]);
});

test('searches task title/key and applies validated multi-task filters', () => {
  const reports = [
    { id: 10, issue_key: 'SALE-10', title: 'January sales report', created_at: '2026-08-24T12:00:00.000Z' },
    { id: 11, issue_key: 'SALE-11', title: 'Customer follow-up', created_at: '2026-08-24T14:00:00.000Z' },
    { id: 12, issue_key: 'SALE-12', title: 'Monthly revenue', created_at: '2026-08-24T16:00:00.000Z' },
  ];
  const options = reports.map((issue) => ({ value: String(issue.id), name: issue.title, issueKey: issue.issue_key }));
  assert.deepEqual(filterAssigneeSuggestions(options, 'revenue').map(({ value }) => value), ['12']);
  assert.deepEqual(filterAssigneeSuggestions(options, 'sale-11').map(({ value }) => value), ['11']);
  assert.deepEqual(normalizeTaskFilter('10,12,10,999', reports), ['10', '12']);
  assert.deepEqual(filterReportIssues(reports, { tasks: ['10', '12'] }).map(({ id }) => id), [10, 12]);
});
