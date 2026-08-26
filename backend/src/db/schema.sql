CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(120)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    account_role  VARCHAR(20)   NOT NULL DEFAULT 'member'
                  CHECK (account_role IN ('overall_admin', 'admin', 'member')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    deactivated_by INTEGER REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_users_single_overall_admin ON users ((account_role)) WHERE account_role = 'overall_admin';
CREATE INDEX idx_users_active_directory ON users (name, email) WHERE deactivated_at IS NULL;

CREATE TABLE user_preferences (
    user_id                INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    locale                 VARCHAR(20) NOT NULL DEFAULT 'en',
    time_zone              VARCHAR(80) NOT NULL DEFAULT 'UTC',
    email_notifications    BOOLEAN     NOT NULL DEFAULT true,
    in_app_notifications   BOOLEAN     NOT NULL DEFAULT true,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_settings (
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

INSERT INTO system_settings (id) VALUES (1);

CREATE TABLE projects (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key         VARCHAR(10)  NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    created_by  INTEGER      NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    template_key VARCHAR(40)  NOT NULL DEFAULT 'kanban',
    enabled_features JSONB    NOT NULL DEFAULT '["summary","backlog","board","development","timeline","docs","forms"]'::jsonb,
    CHECK (jsonb_typeof(enabled_features) = 'array')
);

CREATE TABLE project_members (
    project_id   INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_role VARCHAR(20) NOT NULL CHECK (project_role IN ('admin', 'member', 'viewer')),
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_issue_sequences (
    project_id  INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE issue_types (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    color      VARCHAR(20),
    UNIQUE (project_id, name)
);

CREATE TABLE workflow_statuses (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    position   INTEGER     NOT NULL,
    is_default BOOLEAN     NOT NULL DEFAULT false,
    is_final   BOOLEAN     NOT NULL DEFAULT false,
    UNIQUE (project_id, name)
);

CREATE TABLE sprints (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       VARCHAR(160) NOT NULL,
    goal       TEXT,
    status     VARCHAR(20)  NOT NULL DEFAULT 'planned'
               CHECK (status IN ('planned', 'active', 'completed')),
    start_date DATE,
    end_date   DATE,
    created_by INTEGER      NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (project_id, name),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE issues (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id    INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_key     VARCHAR(20)  NOT NULL UNIQUE,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    issue_type_id INTEGER      NOT NULL REFERENCES issue_types(id),
    status_id     INTEGER      NOT NULL REFERENCES workflow_statuses(id),
    reporter_id   INTEGER      NOT NULL REFERENCES users(id),
    assignee_id   INTEGER      REFERENCES users(id),
    priority      VARCHAR(10)  NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('lowest', 'low', 'medium', 'high', 'highest')),
    metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    sprint_id     INTEGER      REFERENCES sprints(id) ON DELETE SET NULL,
    due_date      DATE,
    story_points  INTEGER      CHECK (story_points BETWEEN 0 AND 100),
    backlog_rank  BIGINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE issue_status_history (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id       INTEGER     NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    from_status_id INTEGER     REFERENCES workflow_statuses(id),
    to_status_id   INTEGER     NOT NULL REFERENCES workflow_statuses(id),
    changed_by     INTEGER     NOT NULL REFERENCES users(id),
    changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comments (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id   INTEGER     NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id    INTEGER     NOT NULL REFERENCES users(id),
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE issue_attachments (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id    INTEGER      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    uploaded_by INTEGER      NOT NULL REFERENCES users(id),
    file_name   VARCHAR(255) NOT NULL,
    media_type  VARCHAR(120) NOT NULL,
    file_size   INTEGER      CHECK (file_size BETWEEN 1 AND 10485760),
    file_data   BYTEA,
    external_url VARCHAR(2048),
    provider    VARCHAR(80),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT issue_attachments_size_matches_data CHECK (file_data IS NULL OR octet_length(file_data) = file_size),
    CONSTRAINT issue_attachments_exactly_one_source CHECK (
        (external_url IS NOT NULL AND file_data IS NULL AND file_size IS NULL)
        OR (external_url IS NULL AND file_data IS NOT NULL AND file_size IS NOT NULL)
    )
);

CREATE TABLE project_docs (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    content    TEXT         NOT NULL DEFAULT '',
    created_by INTEGER      NOT NULL REFERENCES users(id),
    updated_by INTEGER      NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE project_forms (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    fields      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_by  INTEGER      NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(fields) = 'array')
);

CREATE TABLE form_submissions (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    form_id      INTEGER     NOT NULL REFERENCES project_forms(id) ON DELETE CASCADE,
    submitted_by INTEGER     NOT NULL REFERENCES users(id),
    answers      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(answers) = 'object')
);

CREATE TABLE development_links (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id   INTEGER      REFERENCES issues(id) ON DELETE SET NULL,
    provider   VARCHAR(80)  NOT NULL DEFAULT 'Other',
    link_type  VARCHAR(30)  NOT NULL
               CHECK (link_type IN ('branch', 'commit', 'pull_request', 'build', 'deployment')),
    title      VARCHAR(240) NOT NULL,
    url        TEXT         NOT NULL,
    status     VARCHAR(40),
    created_by INTEGER      NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE INDEX idx_issues_status_id ON issues(status_id);
CREATE INDEX idx_issues_assignee_id ON issues(assignee_id);
CREATE INDEX idx_issues_updated_at ON issues(project_id, updated_at);
CREATE INDEX idx_comments_issue_id ON comments(issue_id);
CREATE INDEX idx_issue_attachments_issue_created ON issue_attachments(issue_id, created_at DESC);
CREATE INDEX idx_status_history_issue_id ON issue_status_history(issue_id);
CREATE INDEX idx_issue_types_project ON issue_types(project_id);
CREATE INDEX idx_workflow_statuses_project ON workflow_statuses(project_id);
CREATE INDEX idx_sprints_project_status ON sprints(project_id, status);
CREATE UNIQUE INDEX idx_sprints_one_active ON sprints(project_id) WHERE status = 'active';
CREATE INDEX idx_issues_project_backlog ON issues(project_id, sprint_id, backlog_rank);
CREATE INDEX idx_issues_project_due_date ON issues(project_id, due_date);
CREATE INDEX idx_issues_project_created_at ON issues(project_id, created_at);
CREATE INDEX idx_issues_project_completed_at ON issues(project_id, completed_at);
CREATE INDEX idx_project_docs_project_updated ON project_docs(project_id, updated_at DESC);
CREATE INDEX idx_project_forms_project ON project_forms(project_id);
CREATE INDEX idx_form_submissions_form_created ON form_submissions(form_id, created_at DESC);
CREATE INDEX idx_development_links_project_created ON development_links(project_id, created_at DESC);
