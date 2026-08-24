const { appKeys, templates } = require('../config/spaceTemplates');
const settingsService = require('../services/settings.service');
const HttpError = require('../utils/httpError');
const { requireObject, requireString } = require('../utils/validation');

const locales = new Set(['en', 'vi']);
const timeZones = new Set(['UTC', 'Asia/Saigon', 'Asia/Singapore', 'Europe/London', 'America/New_York']);
function boolean(value, field) { if (typeof value !== 'boolean') throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a boolean`); return value; }
function enumValue(value, field, allowed) { const normalized = requireString(value, field, { min: 1, max: 80 }); if (!allowed.has(normalized)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is not supported`); return normalized; }
function appList(value) { if (!Array.isArray(value) || value.some((item) => !appKeys.includes(item)) || new Set(value).size !== value.length) throw new HttpError(400, 'VALIDATION_ERROR', 'enabledApps contains unsupported or duplicate services'); return value; }

async function getMe(request, response) { response.json({ preferences: await settingsService.getPreferences(request.user.userId) }); }
async function updateMe(request, response) {
  const body = requireObject(request.body); const changes = {};
  if (body.locale !== undefined) changes.locale = enumValue(body.locale, 'locale', locales);
  if (body.timeZone !== undefined) changes.time_zone = enumValue(body.timeZone, 'timeZone', timeZones);
  if (body.emailNotifications !== undefined) changes.email_notifications = boolean(body.emailNotifications, 'emailNotifications');
  if (body.inAppNotifications !== undefined) changes.in_app_notifications = boolean(body.inAppNotifications, 'inAppNotifications');
  if (!Object.keys(changes).length) throw new HttpError(400, 'VALIDATION_ERROR', 'At least one preference must be provided');
  response.json({ preferences: await settingsService.updatePreferences(request.user.userId, changes) });
}
async function changePassword(request, response) { const body = requireObject(request.body); await settingsService.changePassword(request.user.userId, requireString(body.currentPassword, 'currentPassword', { min: 1, max: 72 }), requireString(body.newPassword, 'newPassword', { min: 8, max: 72 })); response.status(204).send(); }
async function getSystem(request, response) { response.json({ system: await settingsService.getSystem() }); }
async function updateSystem(request, response) {
  const body = requireObject(request.body); const changes = {};
  if (body.instanceName !== undefined) changes.instance_name = requireString(body.instanceName, 'instanceName', { min: 1, max: 120 });
  if (body.defaultLocale !== undefined) changes.default_locale = enumValue(body.defaultLocale, 'defaultLocale', locales);
  if (body.defaultTimeZone !== undefined) changes.default_time_zone = enumValue(body.defaultTimeZone, 'defaultTimeZone', timeZones);
  if (body.emailNotificationsEnabled !== undefined) changes.email_notifications_enabled = boolean(body.emailNotificationsEnabled, 'emailNotificationsEnabled');
  if (body.inAppNotificationsEnabled !== undefined) changes.in_app_notifications_enabled = boolean(body.inAppNotificationsEnabled, 'inAppNotificationsEnabled');
  if (body.enabledApps !== undefined) changes.enabled_apps = appList(body.enabledApps);
  if (!Object.keys(changes).length) throw new HttpError(400, 'VALIDATION_ERROR', 'At least one system setting must be provided');
  response.json({ system: await settingsService.updateSystem(changes) });
}
function listTemplates(request, response) { response.json({ templates }); }

module.exports = { changePassword, getMe, getSystem, listTemplates, updateMe, updateSystem };
