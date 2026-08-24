const pool = require('../config/db');

async function getPreferences(userId, client = pool) {
  const result = await client.query(
    `SELECT user_id, locale, time_zone, email_notifications, in_app_notifications, updated_at
       FROM user_preferences WHERE user_id = $1`, [userId],
  );
  return result.rows[0] ?? { user_id: userId, locale: 'en', time_zone: 'UTC', email_notifications: true, in_app_notifications: true, updated_at: null };
}

async function updatePreferences(userId, changes, client = pool) {
  const current = await getPreferences(userId, client);
  const values = { ...current, ...changes };
  const result = await client.query(
    `INSERT INTO user_preferences (user_id, locale, time_zone, email_notifications, in_app_notifications, updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (user_id) DO UPDATE SET locale=EXCLUDED.locale, time_zone=EXCLUDED.time_zone,
       email_notifications=EXCLUDED.email_notifications, in_app_notifications=EXCLUDED.in_app_notifications, updated_at=now()
     RETURNING user_id, locale, time_zone, email_notifications, in_app_notifications, updated_at`,
    [userId, values.locale, values.time_zone, values.email_notifications, values.in_app_notifications],
  );
  return result.rows[0];
}

async function getSystem(client = pool) {
  const result = await client.query(`SELECT id, instance_name, default_locale, default_time_zone,
    email_notifications_enabled, in_app_notifications_enabled, enabled_apps, updated_at FROM system_settings WHERE id=1`);
  return result.rows[0];
}

async function updateSystem(changes, client = pool) {
  const current = await getSystem(client); const values = { ...current, ...changes };
  const result = await client.query(
    `UPDATE system_settings SET instance_name=$1, default_locale=$2, default_time_zone=$3,
      email_notifications_enabled=$4, in_app_notifications_enabled=$5, enabled_apps=$6::jsonb, updated_at=now()
     WHERE id=1 RETURNING id, instance_name, default_locale, default_time_zone,
      email_notifications_enabled, in_app_notifications_enabled, enabled_apps, updated_at`,
    [values.instance_name, values.default_locale, values.default_time_zone, values.email_notifications_enabled, values.in_app_notifications_enabled, JSON.stringify(values.enabled_apps)],
  );
  return result.rows[0];
}

module.exports = { getPreferences, getSystem, updatePreferences, updateSystem };
