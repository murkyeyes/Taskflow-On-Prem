BEGIN;

CREATE TABLE IF NOT EXISTS sprints (
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

ALTER TABLE issues ADD COLUMN IF NOT EXISTS sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS story_points INTEGER CHECK (story_points BETWEEN 0 AND 100);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS backlog_rank BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_docs (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    content    TEXT         NOT NULL DEFAULT '',
    created_by INTEGER      NOT NULL REFERENCES users(id),
    updated_by INTEGER      NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_forms (
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

CREATE TABLE IF NOT EXISTS form_submissions (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    form_id      INTEGER     NOT NULL REFERENCES project_forms(id) ON DELETE CASCADE,
    submitted_by INTEGER     NOT NULL REFERENCES users(id),
    answers      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(answers) = 'object')
);

CREATE TABLE IF NOT EXISTS development_links (
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

CREATE INDEX IF NOT EXISTS idx_sprints_project_status ON sprints(project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sprints_one_active ON sprints(project_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_issues_project_backlog ON issues(project_id, sprint_id, backlog_rank);
CREATE INDEX IF NOT EXISTS idx_issues_project_due_date ON issues(project_id, due_date);
CREATE INDEX IF NOT EXISTS idx_project_docs_project_updated ON project_docs(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_forms_project ON project_forms(project_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_created ON form_submissions(form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_development_links_project_created ON development_links(project_id, created_at DESC);

COMMIT;
