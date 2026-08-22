const defaultWorkflowStatuses = Object.freeze([
  Object.freeze({ name: 'To Do', position: 0, isDefault: true, isFinal: false }),
  Object.freeze({ name: 'In Progress', position: 1, isDefault: false, isFinal: false }),
  Object.freeze({ name: 'Done', position: 2, isDefault: false, isFinal: true }),
]);

module.exports = defaultWorkflowStatuses;
