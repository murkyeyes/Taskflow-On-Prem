CREATE TABLE IF NOT EXISTS user_preferences (
    user_id                INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    locale                 VARCHAR(20) NOT NULL DEFAULT 'en',
    time_zone              VARCHAR(80) NOT NULL DEFAULT 'UTC',
    email_notifications    BOOLEAN     NOT NULL DEFAULT true,
    in_app_notifications   BOOLEAN     NOT NULL DEFAULT true,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
    id                           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    instance_name                VARCHAR(120) NOT NULL DEFAULT 'Taskflow',
    default_locale               VARCHAR(20)  NOT NULL DEFAULT 'en',
    default_time_zone            VARCHAR(80)  NOT NULL DEFAULT 'UTC',
    email_notifications_enabled  BOOLEAN      NOT NULL DEFAULT true,
    in_app_notifications_enabled BOOLEAN      NOT NULL DEFAULT true,
    enabled_apps                 JSONB        NOT NULL DEFAULT '["development","timeline","docs","forms"]'::jsonb,
    updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(enabled_apps) = 'array')
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_key VARCHAR(40) NOT NULL DEFAULT 'kanban';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS enabled_features JSONB NOT NULL DEFAULT '["summary","backlog","board","development","timeline","docs","forms"]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_enabled_features_array') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_enabled_features_array CHECK (jsonb_typeof(enabled_features) = 'array');
  END IF;
END $$;
