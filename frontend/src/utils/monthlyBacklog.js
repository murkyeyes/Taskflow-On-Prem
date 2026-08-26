const localeNames = { en: 'en-US', vi: 'vi-VN' };

export async function loadAllIssuePages(fetchPage, pageSize = 100) {
  const issues = [];
  let page = 1;
  let total = 0;
  do {
    const result = await fetchPage(page, pageSize);
    issues.push(...result.issues);
    total = result.total;
    page += 1;
  } while (issues.length < total);
  return issues;
}

export function monthKeyFor(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthlyArchive(issues) {
  const counts = new Map();
  issues.forEach((issue) => {
    const key = monthKeyFor(issue.created_at);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.key.localeCompare(left.key));
}

export function filterIssuesByMonth(issues, month) {
  if (!month || month === 'all') return issues;
  return issues.filter((issue) => monthKeyFor(issue.created_at) === month);
}

export function normalizeMonthKey(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '') ? value : null;
}

export function monthlyBoardPath(projectId, month) {
  const normalizedMonth = normalizeMonthKey(month);
  return normalizedMonth ? `/projects/${projectId}/board?month=${normalizedMonth}` : `/projects/${projectId}/board`;
}

export function availableReportYears(issues, fallbackYear = new Date().getFullYear()) {
  const years = new Set();
  issues.forEach((issue) => {
    const key = monthKeyFor(issue.created_at);
    if (key) years.add(Number(key.slice(0, 4)));
  });
  return years.size ? [...years].sort((left, right) => right - left) : [fallbackYear];
}

export function normalizeReportYear(value, availableYears) {
  const year = Number(value);
  return Number.isInteger(year) && availableYears.includes(year) ? year : availableYears[0];
}

export function normalizeReportMonth(value, fallbackMonth = 1) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallbackMonth;
}

export function daysInReportMonth(year, month, locale = 'en') {
  const dayCount = new Date(year, month, 0).getDate();
  const dateLocale = localeNames[locale] ?? localeNames.en;
  return Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    return {
      day,
      weekday: new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(year, month - 1, day)),
    };
  });
}

export function reportDayFor(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getDate();
}

export function normalizeReportDay(value, maximumDay) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= maximumDay ? day : null;
}

export function normalizeAssigneeFilter(value, options = [], hasUnassigned = false) {
  const allowed = new Set(options.map(({ id }) => String(id)));
  if (hasUnassigned) allowed.add('unassigned');
  return [...new Set(String(value ?? '').split(',').map((entry) => entry.trim()).filter((entry) => allowed.has(entry)))];
}

export function normalizeTaskFilter(value, issues = []) {
  const allowed = new Set(issues.map(({ id }) => String(id)));
  return [...new Set(String(value ?? '').split(',').map((entry) => entry.trim()).filter((entry) => allowed.has(entry)))];
}

export function filterReportIssues(issues, { day = null, assignee = '', assignees = null, status = '', tasks = [] } = {}) {
  const selectedAssignees = assignees ?? (assignee ? [assignee] : []);
  return issues.filter((issue) => {
    if (day && reportDayFor(issue.created_at) !== day) return false;
    if (tasks.length && !tasks.includes(String(issue.id))) return false;
    if (selectedAssignees.length) {
      const assigneeValue = issue.assignee_id == null ? 'unassigned' : String(issue.assignee_id);
      if (!selectedAssignees.includes(assigneeValue)) return false;
    }
    if (status && issue.status_id !== Number(status)) return false;
    return true;
  });
}

export function filterAssigneeSuggestions(options, query) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return options;
  return options.filter(({ name, issueKey = '' }) => `${issueKey} ${name}`.toLocaleLowerCase().includes(term));
}

export function formatMonth(key, locale = 'en') {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(localeNames[locale] ?? localeNames.en, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

export function formatCreatedDate(value, locale = 'en') {
  return new Intl.DateTimeFormat(localeNames[locale] ?? localeNames.en, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
