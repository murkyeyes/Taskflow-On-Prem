# System Design — Supplement: DB Schema / API Spec / Sequence Diagram / Folder Architecture

> Supplement to `System Design Addendum — Deployment on Windows PC with Docker + PostgreSQL`.
> Decisions applied in this document:
> - `issue_type` and `workflow_status` are **customizable per project** (not fixed globally across the system).
> - The backend follows a **layered architecture**: `routes → controllers → services → repositories`.

---

## 1. Database Schema (Full PostgreSQL DDL)

```sql
-- ========== users ==========
CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(120)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ========== projects ==========
CREATE TABLE projects (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key         VARCHAR(10)   NOT NULL UNIQUE,      -- e.g. "PROJ" -> issue_key "PROJ-123"
    name        VARCHAR(200)  NOT NULL,
    description TEXT,
    created_by  INTEGER       NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ========== project_members ==========
CREATE TABLE project_members (
    project_id   INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id      INTEGER      NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    project_role VARCHAR(20)  NOT NULL CHECK (project_role IN ('admin', 'member', 'viewer')),
    joined_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

-- ========== project_issue_sequences ==========
-- A separate counter table for each project to generate issue_key values such as "PROJ-123" atomically.
CREATE TABLE project_issue_sequences (
    project_id  INTEGER  PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    last_number INTEGER  NOT NULL DEFAULT 0
);

-- ========== issue_types (customizable per project) ==========
CREATE TABLE issue_types (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       VARCHAR(50)  NOT NULL,          -- e.g. "Bug", "Task", "Story"
    color      VARCHAR(20),                    -- optional display color code
    UNIQUE (project_id, name)
);

-- ========== workflow_statuses (customizable per project) ==========
CREATE TABLE workflow_statuses (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       VARCHAR(50)  NOT NULL,          -- e.g. "To Do", "In Progress", "Done"
    position   INTEGER      NOT NULL,          -- display order on the board (0,1,2,...)
    is_default BOOLEAN      NOT NULL DEFAULT false,  -- default status assigned when creating a new issue
    is_final   BOOLEAN      NOT NULL DEFAULT false,  -- status considered "completed" (e.g. Done)
    UNIQUE (project_id, name)
);

-- ========== issues ==========
CREATE TABLE issues (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id    INTEGER      NOT NULL REFERENCES projects(id)       ON DELETE CASCADE,
    issue_key     VARCHAR(20)  NOT NULL UNIQUE,      -- e.g. "PROJ-123"
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    issue_type_id INTEGER      NOT NULL REFERENCES issue_types(id),
    status_id     INTEGER      NOT NULL REFERENCES workflow_statuses(id),
    reporter_id   INTEGER      NOT NULL REFERENCES users(id),
    assignee_id   INTEGER      REFERENCES users(id),
    priority      VARCHAR(10)  NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('lowest', 'low', 'medium', 'high', 'highest')),
    metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- flexible custom fields, if needed
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ========== issue_status_history ==========
CREATE TABLE issue_status_history (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id       INTEGER      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    from_status_id INTEGER      REFERENCES workflow_statuses(id),  -- NULL when the issue is first created
    to_status_id   INTEGER      NOT NULL REFERENCES workflow_statuses(id),
    changed_by     INTEGER      NOT NULL REFERENCES users(id),
    changed_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ========== comments ==========
CREATE TABLE comments (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id   INTEGER      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id    INTEGER      NOT NULL REFERENCES users(id),
    content    TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

-- ========== issue_attachments ==========
CREATE TABLE issue_attachments (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id      INTEGER      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    uploaded_by   INTEGER      NOT NULL REFERENCES users(id),
    file_name     VARCHAR(255) NOT NULL,
    media_type    VARCHAR(120) NOT NULL,
    file_size     INTEGER      NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
    file_data     BYTEA        NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ========== Indexes for common queries ==========
CREATE INDEX idx_issues_project_id   ON issues(project_id);
CREATE INDEX idx_issues_status_id    ON issues(status_id);
CREATE INDEX idx_issues_assignee_id  ON issues(assignee_id);
CREATE INDEX idx_issues_updated_at   ON issues(project_id, updated_at);  -- supports polling for "changes since time X"
CREATE INDEX idx_comments_issue_id   ON comments(issue_id);
CREATE INDEX idx_issue_attachments_issue_created ON issue_attachments(issue_id, created_at DESC);
CREATE INDEX idx_status_history_issue_id ON issue_status_history(issue_id);
CREATE INDEX idx_issue_types_project     ON issue_types(project_id);
CREATE INDEX idx_workflow_statuses_project ON workflow_statuses(project_id);
```

**Important notes:**
- `issue_key` is generated by combining `projects.key` with the number from `project_issue_sequences.last_number`, incremented atomically within a transaction (see Section 3.2 — Sequence Diagram).
- Because `issue_type`/`workflow_status` now belong to individual projects, creating a new project **must seed a default set** (e.g. issue types "Task/Bug/Story", statuses "To Do/In Progress/Done" with the corresponding `is_default`/`is_final` values) — see the `POST /api/projects` API in Section 2.
- `idx_issues_updated_at` exists specifically to support polling (the client asks "what has changed since time T" — see Section 3.4).

---

## 2. API Spec

General conventions:
- Base path: `/api`
- Auth: JWT stored in an HttpOnly Cookie (cookie name `token`); `requireAuth` middleware applies to every route except `auth/register` and `auth/login`.
- Authorization by `project_role` (`admin` / `member` / `viewer`) is enforced through `requireRole([...])` middleware and resolved using the `project_id`/`issue_key` present in the route.
- Standard error response format: `{ "error": { "code": "...", "message": "..." } }`.

### 2.1 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create a new user. Body: `{ name, email, password }` |
| POST | `/auth/login` | No | Body: `{ email, password }`. Returns JWT via Set-Cookie (HttpOnly); response body returns `{ user }` |
| POST | `/auth/logout` | Yes | Clear the cookie |
| GET  | `/auth/me` | Yes | Return the current user information from the token |

### 2.2 Projects

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/projects` | Authenticated | Admin: list every Space; non-admin: list only assigned Spaces |
| POST | `/projects` | Application Admin | Create a Space; creator becomes `admin`, selected `viewerIds` become viewers, and defaults are seeded atomically |
| GET | `/projects/:projectId` | viewer | Project details |
| PATCH | `/projects/:projectId` | admin | Update `name`/`description` |
| DELETE | `/projects/:projectId` | admin | Delete project (cascade all related data) |

### 2.3 Project Members

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/projects/:projectId/members` | member | List members and roles |
| POST | `/projects/:projectId/members` | admin | Add a member. Body: `{ userId, projectRole }` |
| PATCH | `/projects/:projectId/members/:userId` | admin | Change `projectRole` |
| DELETE | `/projects/:projectId/members/:userId` | admin | Remove a member |

### 2.4 Issue Types (customizable per project)

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/projects/:projectId/issue-types` | viewer | List project issue types |
| POST | `/projects/:projectId/issue-types` | admin | Body: `{ name, color? }` |
| PATCH | `/projects/:projectId/issue-types/:id` | admin | Update `name`/`color` |
| DELETE | `/projects/:projectId/issue-types/:id` | admin | Delete (blocked if any issue currently uses this type — return 409) |

### 2.5 Workflow Statuses (customizable per project)

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/projects/:projectId/workflow-statuses` | viewer | List statuses ordered by `position` |
| POST | `/projects/:projectId/workflow-statuses` | admin | Body: `{ name, position, isDefault?, isFinal? }` |
| PATCH | `/projects/:projectId/workflow-statuses/:id` | admin | Update properties |
| PATCH | `/projects/:projectId/workflow-statuses/reorder` | admin | Body: `{ orderedIds: [id1, id2, ...] }` — update `position` values in bulk |
| DELETE | `/projects/:projectId/workflow-statuses/:id` | admin | Block deletion if any issue is currently in this status (409) |

### 2.6 Issues

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/projects/:projectId/issues` | viewer | Query params: `status_id`, `assignee_id`, `issue_type_id`, `created_on`, `completed_on`, `page`, `pageSize` |
| POST | `/projects/:projectId/issues` | member | Body: `{ title, description?, issueTypeId, assigneeId?, priority? }`. Service generates `issue_key` atomically (Section 3.2) and assigns `status_id` to the project's status where `is_default = true` |
| GET | `/issues/:issueKey` | viewer | Issue details |
| PATCH | `/issues/:issueKey` | member | Update `title`/`description`/`assigneeId`/`priority`/`issueTypeId` |
| PATCH | `/issues/:issueKey/status` | member | Body: `{ statusId }` — change status; service records the change in `issue_status_history` within the same transaction (Section 3.3) |
| DELETE | `/issues/:issueKey` | admin | Delete issue |

### 2.7 Comments

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/issues/:issueKey/comments` | viewer | List comments ordered by `created_at` |
| POST | `/issues/:issueKey/comments` | member | Body: `{ content }` |
| PATCH | `/comments/:id` | member (author only) | Update `content`, set `updated_at` |
| DELETE | `/comments/:id` | member (author) or admin | Delete comment |

### 2.8 Polling (near-real-time updates, no WebSocket)

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/projects/:projectId/updates?since=<ISO timestamp>` | viewer | Return issues with `updated_at > since`, plus new comments for those issues. The client calls periodically (recommended every 5–10s) and uses the returned `serverTime` as `since` for the next request to avoid client/server clock drift |

### 2.9 Issue report attachments

The Issue Detail comments panel is replaced by a Report files panel. Legacy comment data and APIs remain available for compatibility, but no comment composer is rendered.

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| GET | `/issues/:issueKey/attachments` | viewer | List attachment metadata without binary data |
| POST | `/issues/:issueKey/attachments` | member | Raw body up to 10 MiB; `X-File-Name` and `Content-Type` required; accepts `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx` |
| GET | `/attachments/:id/download` | viewer | Download the file after effective Space access is verified |
| DELETE | `/attachments/:id` | member uploader or admin | Member may delete only their own file and only while issue is not final; Admin may always delete |

Upload runs in a transaction: lock the issue, resolve the current workflow status, reject non-admin mutation when `is_final`, validate extension/MIME/signature/size, insert attachment, then touch `issues.updated_at`. Deletion uses the same completed-lock and authorization rules. Bytes are stored as `BYTEA` so the existing `pg_dump -Fc` backup includes report files.

---

## 3. Sequence Diagrams

### 3.1 Login

```mermaid
sequenceDiagram
    participant C as Client (React)
    participant R as Route/Controller
    participant S as AuthService
    participant Repo as UserRepository
    participant DB as PostgreSQL

    C->>R: POST /auth/login {email, password}
    R->>S: login(email, password)
    S->>Repo: findByEmail(email)
    Repo->>DB: SELECT * FROM users WHERE email = $1
    DB-->>Repo: user row
    Repo-->>S: user
    S->>S: bcrypt.compare(password, user.password_hash)
    alt password is correct
        S->>S: sign JWT (userId)
        S-->>R: {user, token}
        R-->>C: 200 + Set-Cookie(token, HttpOnly)
    else incorrect
        S-->>R: AuthError
        R-->>C: 401 {error}
    end
```

### 3.2 Create a New Issue (atomic `issue_key` generation)

```mermaid
sequenceDiagram
    participant C as Client
    participant R as IssueController
    participant S as IssueService
    participant Repo as IssueRepository
    participant DB as PostgreSQL

    C->>R: POST /projects/:id/issues {title, issueTypeId, ...}
    R->>S: createIssue(projectId, data, currentUser)
    S->>Repo: withTransaction(async tx => ...)
    activate Repo
    Repo->>DB: BEGIN
    Repo->>DB: SELECT key FROM projects WHERE id = $1 FOR UPDATE
    Repo->>DB: UPDATE project_issue_sequences SET last_number = last_number + 1 WHERE project_id = $1 RETURNING last_number
    DB-->>Repo: last_number = N
    Repo->>Repo: issueKey = `${projectKey}-${N}`
    Repo->>DB: SELECT id FROM workflow_statuses WHERE project_id=$1 AND is_default=true
    Repo->>DB: INSERT INTO issues (..., issue_key, status_id, ...) VALUES (...)
    Repo->>DB: INSERT INTO issue_status_history (issue_id, from_status_id=NULL, to_status_id, changed_by)
    Repo->>DB: COMMIT
    deactivate Repo
    Repo-->>S: issue
    S-->>R: issue
    R-->>C: 201 {issue}
```

*The entire "SELECT ... FOR UPDATE → UPDATE sequence → INSERT issue → INSERT history" block is executed within ONE transaction to guarantee atomicity when multiple users create issues concurrently in the same project — consistent with Section 2.5 of `RULES.md`.*

### 3.3 Change Issue Status

```mermaid
sequenceDiagram
    participant C as Client
    participant R as IssueController
    participant S as IssueService
    participant Repo as IssueRepository
    participant DB as PostgreSQL

    C->>R: PATCH /issues/:issueKey/status {statusId}
    R->>S: changeStatus(issueKey, newStatusId, currentUser)
    S->>Repo: withTransaction(async tx => ...)
    Repo->>DB: BEGIN
    Repo->>DB: SELECT status_id FROM issues WHERE issue_key=$1 FOR UPDATE
    DB-->>Repo: oldStatusId
    Repo->>DB: UPDATE issues SET status_id=$2, updated_at=now() WHERE issue_key=$1
    Repo->>DB: INSERT INTO issue_status_history (issue_id, from_status_id=oldStatusId, to_status_id=$2, changed_by)
    Repo->>DB: COMMIT
    Repo-->>S: updatedIssue
    S-->>R: updatedIssue
    R-->>C: 200 {issue}
```

### 3.4 Polling for Updates (no WebSocket)

```mermaid
sequenceDiagram
    participant C as Client
    participant R as UpdatesController
    participant S as UpdatesService
    participant DB as PostgreSQL

    loop every 5-10 seconds
        C->>R: GET /projects/:id/updates?since=<lastSyncTime>
        R->>S: getUpdatesSince(projectId, since)
        S->>DB: SELECT * FROM issues WHERE project_id=$1 AND updated_at > $2
        S->>DB: SELECT * FROM comments WHERE issue_id IN (...) AND created_at > $2
        DB-->>S: changed issues + new comments
        S-->>R: {issues, comments, serverTime: now()}
        R-->>C: 200 {...}
        C->>C: merge into local state, store serverTime as since for the next request
    end
```

---

## 4. Folder Architecture

### 4.1 Backend — Layered (`routes → controllers → services → repositories`)

```text
backend/
├── src/
│   ├── config/
│   │   ├── env.js                # read & validate environment variables (.env)
│   │   └── db.js                 # initialize pg.Pool, export shared pool
│   │
│   ├── routes/                   # declare paths + attach controllers ONLY, NO business logic
│   │   ├── auth.routes.js
│   │   ├── project.routes.js
│   │   ├── member.routes.js
│   │   ├── issueType.routes.js
│   │   ├── workflowStatus.routes.js
│   │   ├── issue.routes.js
│   │   ├── comment.routes.js
│   │   └── update.routes.js      # polling endpoint
│   │
│   ├── controllers/              # receive request, validate input, call service, format response
│   │   ├── auth.controller.js
│   │   ├── project.controller.js
│   │   ├── member.controller.js
│   │   ├── issueType.controller.js
│   │   ├── workflowStatus.controller.js
│   │   ├── issue.controller.js
│   │   ├── comment.controller.js
│   │   └── update.controller.js
│   │
│   ├── services/                 # pure business logic, knows NOTHING about HTTP (req/res)
│   │   ├── auth.service.js       # hash/verify password, sign/verify JWT
│   │   ├── project.service.js    # create project + seed default issue_types/workflow_statuses
│   │   ├── member.service.js
│   │   ├── issueType.service.js
│   │   ├── workflowStatus.service.js
│   │   ├── issue.service.js      # atomic issue_key generation, status changes + history records
│   │   ├── comment.service.js
│   │   └── update.service.js
│   │
│   ├── repositories/             # the ONLY layer that directly accesses SQL through `pg`
│   │   ├── user.repository.js
│   │   ├── project.repository.js
│   │   ├── member.repository.js
│   │   ├── issueType.repository.js
│   │   ├── workflowStatus.repository.js
│   │   ├── issue.repository.js
│   │   ├── issueSequence.repository.js   # dedicated to project_issue_sequences
│   │   ├── issueStatusHistory.repository.js
│   │   └── comment.repository.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js     # requireAuth — verify JWT from cookie
│   │   ├── rbac.middleware.js     # requireRole([...]) — check project_role
│   │   ├── errorHandler.middleware.js
│   │   └── licenseCheck.middleware.js   # validate HOST_FINGERPRINT when the app starts
│   │
│   ├── utils/
│   │   ├── withTransaction.js     # helper wrapping BEGIN/COMMIT/ROLLBACK for pg.Pool
│   │   ├── issueKey.util.js       # format issue_key from project key + number
│   │   └── httpError.js           # standardized error class for the whole app
│   │
│   ├── db/
│   │   ├── schema.sql
│   │   ├── seed.sql               # seed sample admin user; DOES NOT seed issue types/statuses (they are per-project and seeded when creating a project)
│   │   └── defaults/
│   │       ├── defaultIssueTypes.js     # used by project.service when creating a new project
│   │       └── defaultWorkflowStatuses.js
│   │
│   ├── app.js                     # initialize Express app, attach middleware + routes
│   └── server.js                  # entry point, app.listen()
│
├── Dockerfile
├── package.json
└── .env.example
```

*Dependency-flow rule:* `routes` only call `controllers` → `controllers` only call `services` (never repositories directly) → `services` only call `repositories` (never write SQL themselves) → `repositories` are the ONLY place where SQL statements are stored. A transaction (`withTransaction`) is opened in the `service` layer when a business operation requires multiple atomic DB operations (e.g. creating an issue or changing status), and the `tx` object is then passed down to the relevant repository functions.

### 4.2 Frontend (React)

```text
frontend/
├── src/
│   ├── api/                      # one file per resource, wrapping fetch/axios calls to the backend
│   │   ├── client.js            # shared configuration (baseURL, withCredentials for cookies)
│   │   ├── auth.api.js
│   │   ├── project.api.js
│   │   ├── issue.api.js
│   │   ├── comment.api.js
│   │   └── update.api.js        # call the polling endpoint
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── ProjectListPage.jsx
│   │   ├── ProjectBoardPage.jsx    # board with columns based on the project's workflow_statuses
│   │   ├── IssueDetailPage.jsx     # issue details + report attachments
│   │   ├── ProjectSettingsPage.jsx # manage issue_types/workflow_statuses (admin)
│   │   └── TeamsPage.jsx           # global account provisioning and Space access (application admin)
│   │
│   ├── components/
│   │   ├── board/
│   │   │   ├── StatusColumn.jsx
│   │   │   └── IssueCard.jsx
│   │   ├── issue/
│   │   │   ├── IssueForm.jsx
│   │   │   └── CommentList.jsx
│   │   └── common/
│   │       ├── Navbar.jsx
│   │       └── RoleGuard.jsx       # show/hide UI based on project_role
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── usePolling.js           # setInterval calls update.api and merges state
│   │
│   ├── contexts/
│   │   └── AuthContext.jsx
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── index.html
├── package.json
└── vite.config.js (or equivalent build configuration)
```

### 4.3 Root Project (matches the `docker-compose.yml` described in the previous document)

```text
project-root/
├── backend/           # see 4.1
├── frontend/          # see 4.2 — builds to frontend/dist, served by Caddy
├── docker-compose.yml
├── Caddyfile
├── .env.example
├── RULES.md
├── CHECKLIST.md
└── backups/
```

## 5. Approved Jira-style Workspace Expansion (2026-08-22)

This section is authoritative and extends Sections 1–4 without changing the required technology stack or layered architecture.

### 5.1 Database additions

The official schema now contains 15 tables. The original nine remain unchanged except for the planning columns added to `issues`; `issue_attachments` stores the approved report-file metadata and bytes.

```sql
CREATE TABLE sprints (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  goal TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed')),
  start_date DATE,
  end_date DATE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

ALTER TABLE issues ADD COLUMN sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN due_date DATE;
ALTER TABLE issues ADD COLUMN story_points INTEGER CHECK (story_points BETWEEN 0 AND 100);
ALTER TABLE issues ADD COLUMN backlog_rank BIGINT NOT NULL DEFAULT 0;

CREATE TABLE project_docs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_forms (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE form_submissions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES project_forms(id) ON DELETE CASCADE,
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE development_links (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_id INTEGER REFERENCES issues(id) ON DELETE SET NULL,
  provider VARCHAR(80) NOT NULL DEFAULT 'Other',
  link_type VARCHAR(30) NOT NULL CHECK (link_type IN ('branch','commit','pull_request','build','deployment')),
  title VARCHAR(240) NOT NULL,
  url TEXT NOT NULL,
  status VARCHAR(40),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sprints_project_status ON sprints(project_id, status);
CREATE INDEX idx_issues_project_backlog ON issues(project_id, sprint_id, backlog_rank);
CREATE INDEX idx_issues_project_due_date ON issues(project_id, due_date);
CREATE INDEX idx_project_docs_project_updated ON project_docs(project_id, updated_at DESC);
CREATE INDEX idx_project_forms_project ON project_forms(project_id);
CREATE INDEX idx_form_submissions_form_created ON form_submissions(form_id, created_at DESC);
CREATE INDEX idx_development_links_project_created ON development_links(project_id, created_at DESC);
```

The implementation migrations must be idempotent for an existing database (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE/INDEX IF NOT EXISTS`). Fresh `schema.sql` must yield the complete 15-table schema.

### 5.2 API additions and RBAC

| Resource | Endpoints | Read | Write |
|---|---|---|---|
| Summary | `GET /api/projects/:projectId/summary` | viewer/member/admin | derived, no direct write |
| Sprints | `GET,POST /api/projects/:projectId/sprints`; `PATCH,DELETE /api/projects/:projectId/sprints/:sprintId` | all roles | member/admin create/update; admin delete |
| Planning | `PATCH /api/issues/:issueKey/planning` | through issue reads | member/admin |
| Development | `GET,POST /api/projects/:projectId/development-links`; `DELETE .../:linkId` | all roles | member/admin |
| Docs | `GET,POST /api/projects/:projectId/docs`; `GET,PATCH,DELETE .../:docId` | all roles | member/admin create/update; admin delete |
| Forms | `GET,POST /api/projects/:projectId/forms`; `GET,PATCH,DELETE .../:formId` | all roles | admin definitions |
| Submissions | `POST /api/projects/:projectId/forms/:formId/submissions`; `GET .../submissions` | submit: all roles; list: member/admin | all roles submit |

All resource identifiers must be verified as belonging to `projectId`. SQL stays exclusively in repositories and is parameterized. Summary is computed from current project issues, statuses, priorities, types, assignees, due dates, and recent status/comment activity.

### 5.3 Transaction and sequence rules

- Sprint create/update validates date order. Only one active sprint per project is allowed; activation locks the project's sprint rows in a transaction and rejects a second active sprint with `409`.
- Planning updates verify that a supplied sprint belongs to the issue's project and update `issues.updated_at` so polling observes the change.
- Form submission validates active form state and stores one JSONB answer object atomically.
- Deleting a sprint preserves issues by setting `issues.sprint_id` to null through the foreign key.
- Existing issue-key and status-history transaction rules remain unchanged.

### 5.4 Frontend routes and folders

Project routes are `/projects/:projectId/summary`, `/backlog`, `/board`, `/timeline`, `/development`, `/docs`, `/forms`, and `/settings`. `/projects/:projectId` remains compatible and redirects to the board or summary.

The React project adds `components/layout/WorkspaceShell.jsx`, `Sidebar.jsx`, `ProjectHeader.jsx`, `ProjectTabs.jsx`, plus one page component for each route above. The shell provides the Jira-style dark visual system and a functional collapsible sidebar. Summary uses native CSS/SVG rather than a new chart framework. Every tab must load real API data and all mutating controls must respect the current project role.

## 6. Board controls and Admin Account Provisioning Expansion (2026-08-22)

This approved expansion keeps the same 14-table schema and technology stack. Public self-registration is removed: `POST /api/auth/register` requires an authenticated user who is an `admin` member of at least one project. Initial deployment creates the bootstrap administrator via the approved seed/deployment process. The dedicated `/teams` application-administration page is the only UI that exposes account creation and cross-Space access management. Account provisioning is independent from Space membership: after creation, an application Admin explicitly grants existing accounts viewer access to selected Spaces or revokes non-admin assignments. Project Settings contains only Space workflow configuration. For its own `projectId`, an Admin can create, rename, recolor, and delete issue types; create, rename, reorder, select the single default, mark final/completed, and delete workflow statuses. Deletion remains blocked with `409` when referenced by an issue.

`GET /api/projects/:projectId/assignees?search=` returns project members whose account name or email matches case-insensitively. It is used by the board issue composer and assignee filter; an issue may only be assigned to a member of its project. `GET /api/projects/:projectId/issues?search=` matches issue key/title case-insensitively. `/teams` uses the existing Admin-only `GET /api/auth/users?search=`, membership list/create/delete endpoints, and never exposes administrator-membership revocation.

The board provides search, an assignee-name typeahead/filter backed by `GET /api/projects/:projectId/assignees?search=`, assignee/status/priority filters, grouping, inline creation in a chosen workflow column, and an admin-only workflow-column creator. Typing a partial member name narrows suggestions and visible cards; selecting a suggestion applies the exact assignee filter, while `Everyone`/Clear filters removes it. `POST /api/projects/:projectId/sprints/:sprintId/complete` is member/admin only and runs in one transaction: lock the project's sprints, verify that the target is active, mark it completed, then remove the sprint from each non-final issue while touching `updated_at`. It returns the completed sprint and the count moved back to the backlog. Creating an issue can accept optional `statusId` and `dueDate`; the initial history row records that supplied/default status.

## 7. Space Creation and Viewer Isolation Expansion (2026-08-22)

The product term is **Space**. To preserve database and API compatibility, a Space is stored in `projects`, its access list is stored in `project_members`, and existing `/api/projects` paths remain canonical. The React UI uses “Spaces”, “Your spaces”, “Create space”, and “Space key”.

Only an authenticated account that has `project_role = 'admin'` in at least one Space may call `POST /api/projects`. The request may include a unique `viewerIds` array of existing user IDs. Space creation, creator-admin membership, viewer memberships, issue-key sequence, default issue types, and default workflow statuses are committed in one transaction. Any invalid account ID rolls back the entire operation.

New assignments are always `viewer`. `POST` and `PATCH /api/projects/:projectId/members...` reject attempts to grant `member` or `admin`; legacy rows remain readable for compatibility. `GET /api/auth/users?search=` is admin-only and returns public account fields for the Space creator and dedicated `/teams` account/access manager.

Space isolation is enforced through the existing RBAC middleware. A non-admin viewer lists only assigned Spaces, and direct requests to any unassigned Space, issue, comment, workspace document, form, sprint, or development resource fail with `403`. Viewers cannot mutate Space data. Section 8 expands application Admin visibility without changing the schema.

## 8. Unified Space Home, Sidebar, and Admin Scope Expansion (2026-08-22)

`/` is the authenticated home page and Space selector. `/projects` remains only as a compatibility redirect to `/`; it must not render the legacy list/create page. Login success redirects to `/`. The home and every Space workspace share one Jira-style sidebar fed by `GET /api/projects`, so the list cannot differ between screens. The active Space expands its Backlog, Board, Timeline, Development, Docs, and Forms navigation.

The sidebar Spaces header contains an Admin-only Create Space action linking to `/spaces/new`. The creation screen retains the canonical `POST /api/projects` transaction and account-name viewer selection. No templates, additional tables, or new service are introduced.

An account with at least one `project_role = 'admin'` membership is the application Admin. `GET /api/projects` returns every Space to that account and the RBAC resolver grants effective `admin` access on every Space/resource. Non-admin accounts receive only their assigned Spaces and retain viewer-only access. This effective Admin scope is derived from existing `project_members`; no schema migration is required.

## 9. Issue completion dates, immutable completion, and self-assignment (2026-08-22)

`issues.completed_at TIMESTAMPTZ NULL` records the current completion timestamp. A transition into a workflow status with `is_final = true` sets it in the same transaction as the status update/history insert. An Admin transition back to a non-final status clears it; re-completion sets a new timestamp. Migration `003-issue-completion.sql` adds the column and project/date indexes to existing installations.

`GET /api/projects/:projectId/issues` accepts `created_on` and `completed_on` as ISO dates and applies half-open day ranges. Board/detail responses include `created_at`, `completed_at`, `assignee_id`, and `assignee_name`. Board cards display the assignee below the title and both applicable dates.

For `member`, create/update requests may set `assigneeId` only to the caller, preserve an existing assignment, or clear it. Admin may assign any actual Space member. If the current workflow status is final, member requests to PATCH issue fields, planning, or status fail with `403 COMPLETED_ISSUE_LOCKED`; Admin retains mutation and reopen authority. These checks are enforced in services after row locking, not only in React.
