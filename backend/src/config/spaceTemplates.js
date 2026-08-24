const featureKeys = Object.freeze(['summary', 'backlog', 'board', 'development', 'timeline', 'docs', 'forms']);
const appKeys = Object.freeze(['development', 'timeline', 'docs', 'forms']);

function freezeTemplate(template) {
  return Object.freeze({
    ...template,
    enabledFeatures: Object.freeze([...template.enabledFeatures]),
    issueTypes: Object.freeze(template.issueTypes.map((item) => Object.freeze({ ...item }))),
    workflowStatuses: Object.freeze(template.workflowStatuses.map((item) => Object.freeze({ ...item }))),
  });
}

const templates = Object.freeze([
  freezeTemplate({ key: 'kanban', name: 'Kanban', category: 'Software development', description: 'Visualize continuous work on a flexible board.', enabledFeatures: featureKeys, issueTypes: [{ name: 'Task', color: '#4C9AFF' }, { name: 'Bug', color: '#E5493A' }, { name: 'Story', color: '#36B37E' }], workflowStatuses: [{ name: 'To Do', position: 0, isDefault: true, isFinal: false }, { name: 'In Progress', position: 1, isDefault: false, isFinal: false }, { name: 'In Review', position: 2, isDefault: false, isFinal: false }, { name: 'Done', position: 3, isDefault: false, isFinal: true }] }),
  freezeTemplate({ key: 'scrum', name: 'Scrum', category: 'Software development', description: 'Plan a backlog and deliver work in short sprint cycles.', enabledFeatures: featureKeys, issueTypes: [{ name: 'Story', color: '#36B37E' }, { name: 'Task', color: '#4C9AFF' }, { name: 'Bug', color: '#E5493A' }, { name: 'Epic', color: '#6554C0' }], workflowStatuses: [{ name: 'To Do', position: 0, isDefault: true, isFinal: false }, { name: 'In Progress', position: 1, isDefault: false, isFinal: false }, { name: 'Review', position: 2, isDefault: false, isFinal: false }, { name: 'Done', position: 3, isDefault: false, isFinal: true }] }),
  freezeTemplate({ key: 'work_requests', name: 'Work requests', category: 'Service management', description: 'Collect, triage, fulfill, and close incoming requests.', enabledFeatures: ['summary', 'backlog', 'board', 'docs', 'forms'], issueTypes: [{ name: 'Request', color: '#4C9AFF' }, { name: 'Incident', color: '#E5493A' }, { name: 'Question', color: '#FFAB00' }], workflowStatuses: [{ name: 'Open', position: 0, isDefault: true, isFinal: false }, { name: 'In Progress', position: 1, isDefault: false, isFinal: false }, { name: 'Waiting', position: 2, isDefault: false, isFinal: false }, { name: 'Resolved', position: 3, isDefault: false, isFinal: true }] }),
  freezeTemplate({ key: 'business', name: 'Business project', category: 'Work management', description: 'Manage tasks, owners, dates, documents, and delivery.', enabledFeatures: ['summary', 'backlog', 'board', 'timeline', 'docs', 'forms'], issueTypes: [{ name: 'Task', color: '#4C9AFF' }, { name: 'Milestone', color: '#6554C0' }, { name: 'Risk', color: '#E5493A' }], workflowStatuses: [{ name: 'To Do', position: 0, isDefault: true, isFinal: false }, { name: 'In Progress', position: 1, isDefault: false, isFinal: false }, { name: 'Blocked', position: 2, isDefault: false, isFinal: false }, { name: 'Done', position: 3, isDefault: false, isFinal: true }] }),
  freezeTemplate({ key: 'personal', name: 'Personal tasks', category: 'Personal productivity', description: 'Keep a focused personal to-do list with simple tracking.', enabledFeatures: ['summary', 'board', 'timeline', 'docs'], issueTypes: [{ name: 'Task', color: '#4C9AFF' }, { name: 'Reminder', color: '#FFAB00' }], workflowStatuses: [{ name: 'To Do', position: 0, isDefault: true, isFinal: false }, { name: 'Doing', position: 1, isDefault: false, isFinal: false }, { name: 'Done', position: 2, isDefault: false, isFinal: true }] }),
]);

function findTemplate(key) { return templates.find((template) => template.key === key); }

module.exports = { appKeys, featureKeys, findTemplate, templates };
