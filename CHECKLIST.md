# CHECKLIST.md — Xây dựng Task/Issue Tracker (Jira-clone)

> Checklist này phải được thực hiện cùng với `RULES.md`,
> `System_Design_Core_DB_API_Sequence_Folder_EN.md` và
> `System_Design_Addendum_Windows_Docker_Postgres.md`.
>
> Chỉ đánh dấu `[x]` khi item đã **IMPLEMENTED + TESTED**.
> Không đánh dấu hoàn thành nếu mới viết code nhưng chưa chạy test tương ứng.

---

## Phase 0 — Project bootstrap

- [x] Xác nhận repository có đầy đủ các tài liệu bắt buộc: `RULES.md`, `CHECKLIST.md`, `System_Design_Core_DB_API_Sequence_Folder_EN.md`, `System_Design_Addendum_Windows_Docker_Postgres.md`
- [x] Tạo/chuẩn hoá root structure: `backend/`, `frontend/`, `docker-compose.yml`, `Caddyfile`, `.env.example`, `backups/`
- [x] Khởi tạo/kiểm tra git repo và `.gitignore`; loại trừ tối thiểu `.env`, `node_modules/`, `frontend/dist/`, `frontend-dist/`, `backups/*.dump`
- [x] Viết/chuẩn hoá `README.md` mô tả dev flow, build flow và Docker deployment flow
- [x] Verify structure thực tế khớp System Design trước khi sang Phase 1

---

## Phase 1 — PostgreSQL database

### 1.1 Schema

- [x] Viết `backend/src/db/schema.sql` cho đúng **9 bảng**: `users`, `projects`, `project_members`, `project_issue_sequences`, `issue_types`, `workflow_statuses`, `issues`, `issue_status_history`, `comments`
- [x] Dùng `GENERATED ALWAYS AS IDENTITY`, `TIMESTAMPTZ`, `JSONB`, foreign keys, `CHECK` constraints và uniqueness đúng theo System Design
- [x] Tạo đầy đủ indexes trong System Design, gồm index phục vụ polling trên `(project_id, updated_at)`
- [x] Verify `issue_types` và `workflow_statuses` là per-project, không phải global

### 1.2 Seed/defaults

- [x] Viết `backend/src/db/seed.sql` cho dữ liệu bootstrap/dev tối thiểu; không seed global issue types/workflow statuses
- [x] Tạo `backend/src/db/defaults/defaultIssueTypes.js`
- [x] Tạo `backend/src/db/defaults/defaultWorkflowStatuses.js`
- [x] Verify bộ defaults có thể được dùng khi tạo project mới

### 1.3 Database validation

- [x] Chạy `schema.sql` trên container `postgres:16-alpine` sạch và xác nhận không lỗi cú pháp
- [x] Chạy `seed.sql` và verify dữ liệu bootstrap
- [x] Query kiểm tra constraints, foreign keys và indexes chính

### 1.4 Atomic issue-key proof

- [x] Viết helper/repository logic dùng `UPDATE project_issue_sequences ... RETURNING last_number`
- [x] Viết test độc lập cho transaction tạo issue: sequence increment + issue insert + initial `issue_status_history` trong cùng transaction
- [x] Chạy concurrency/race-condition test với nhiều request/process cùng tạo issue trong một project
- [x] Verify không duplicate `issue_key`, không mất sequence update và rollback đúng khi insert thất bại

---

## Phase 2 — Backend foundation

### 2.1 Node/Express setup

- [x] Khởi tạo backend Node.js + Express
- [x] Cài dependencies bắt buộc: `pg`, `bcryptjs`, `jsonwebtoken`, `cookie-parser` và dependencies nhỏ thật sự cần thiết
- [x] Tạo `src/config/env.js` để đọc/validate environment variables
- [x] Tạo `src/config/db.js` với shared `pg.Pool`
- [x] Tạo `src/utils/withTransaction.js`
- [x] Tạo `src/utils/httpError.js`
- [x] Tạo `src/app.js` và `src/server.js`

### 2.2 Layered architecture

- [x] Tạo folder `routes/`
- [x] Tạo folder `controllers/`
- [x] Tạo folder `services/`
- [x] Tạo folder `repositories/`
- [x] Tạo folder `middlewares/`
- [x] Verify dependency flow `routes → controllers → services → repositories`
- [x] Verify chỉ repositories chứa SQL

### 2.3 Standard API behavior

- [x] Tạo centralized error handler
- [x] Chuẩn hoá error response thành `{ "error": { "code": "...", "message": "..." } }`
- [x] Tạo input validation hợp lý cho các API chính
- [x] Verify app start và DB connection thành công

---

## Phase 3 — Authentication & RBAC

### 3.1 Authentication

- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`
- [x] Hash password bằng `bcryptjs`
- [x] Sign/verify JWT
- [x] Lưu JWT trong HttpOnly Cookie tên `token`
- [x] Verify frontend/backend không yêu cầu token trong localStorage

### 3.2 Auth middleware

- [x] Implement `requireAuth`
- [x] Verify mọi protected route reject unauthenticated request
- [x] Verify register/login vẫn public

### 3.3 RBAC

- [x] Implement `requireRole([...])` dựa trên `project_members.project_role`
- [x] Support resolve project từ `projectId`
- [x] Support resolve project từ `issueKey`
- [x] Test roles `admin`, `member`, `viewer`
- [x] Test các trường hợp forbidden trả lỗi đúng

---

## Phase 4 — Project domain APIs

### 4.1 Projects

- [x] `GET /api/projects`
- [x] `POST /api/projects`
- [x] `GET /api/projects/:projectId`
- [x] `PATCH /api/projects/:projectId`
- [x] `DELETE /api/projects/:projectId`

### 4.2 Create-project transaction/invariants

- [x] Khi tạo project, creator tự động thành `admin`
- [x] Tạo `project_issue_sequences` với `last_number = 0`
- [x] Seed default issue types từ `defaultIssueTypes.js`
- [x] Seed default workflow statuses từ `defaultWorkflowStatuses.js`
- [x] Giữ các bước tạo project/member/sequence/defaults consistent trong transaction phù hợp
- [x] Test rollback nếu một bước seed thất bại

### 4.3 Project members

- [x] `GET /api/projects/:projectId/members`
- [x] `POST /api/projects/:projectId/members`
- [x] `PATCH /api/projects/:projectId/members/:userId`
- [x] `DELETE /api/projects/:projectId/members/:userId`
- [x] Test admin/member/viewer authorization matrix

### 4.4 Issue types

- [x] `GET /api/projects/:projectId/issue-types`
- [x] `POST /api/projects/:projectId/issue-types`
- [x] `PATCH /api/projects/:projectId/issue-types/:id`
- [x] `DELETE /api/projects/:projectId/issue-types/:id`
- [x] Test delete type đang được issue sử dụng trả `409`

### 4.5 Workflow statuses

- [x] `GET /api/projects/:projectId/workflow-statuses`
- [x] `POST /api/projects/:projectId/workflow-statuses`
- [x] `PATCH /api/projects/:projectId/workflow-statuses/:id`
- [x] `PATCH /api/projects/:projectId/workflow-statuses/reorder`
- [x] `DELETE /api/projects/:projectId/workflow-statuses/:id`
- [x] Test reorder cập nhật `position` đúng
- [x] Test delete status đang được issue sử dụng trả `409`

---

## Phase 5 — Issues, history, comments & polling

### 5.1 Issues

- [x] `GET /api/projects/:projectId/issues`
- [x] Implement filters: `status_id`, `assignee_id`, `issue_type_id`
- [x] Implement pagination: `page`, `pageSize`
- [x] `POST /api/projects/:projectId/issues`
- [x] `GET /api/issues/:issueKey`
- [x] `PATCH /api/issues/:issueKey`
- [x] `DELETE /api/issues/:issueKey`

### 5.2 Create issue transaction

- [x] Dùng atomic issue-key logic đã concurrency-test ở Phase 1
- [x] Verify `issueTypeId` thuộc đúng project
- [x] Lấy default workflow status của đúng project
- [x] Insert issue
- [x] Insert initial `issue_status_history` với `from_status_id = NULL`
- [x] Toàn bộ luồng nằm trong một transaction
- [x] Test rollback và concurrent creation qua API

### 5.3 Change issue status

- [x] `PATCH /api/issues/:issueKey/status`
- [x] Lock/read old status an toàn
- [x] Verify new status thuộc đúng project
- [x] Update issue status + `updated_at`
- [x] Insert `issue_status_history`
- [x] Commit cùng transaction
- [x] Test không có case đổi status mà thiếu history row

### 5.4 Comments

- [x] `GET /api/issues/:issueKey/comments`
- [x] `POST /api/issues/:issueKey/comments`
- [x] `PATCH /api/comments/:id`
- [x] `DELETE /api/comments/:id`
- [x] Enforce author/admin rules
- [x] Test `updated_at` khi edit comment

### 5.5 Polling

- [x] `GET /api/projects/:projectId/updates?since=<ISO timestamp>`
- [x] Trả changed issues theo `updated_at > since`
- [x] Trả new comments tương ứng theo thời gian
- [x] Response có `serverTime`
- [x] Test client có thể dùng `serverTime` làm `since` kế tiếp
- [x] Chốt polling interval mặc định trong khoảng 5–10 giây

### 5.6 Backend API regression

- [x] Chạy full API test suite/script cho auth, RBAC, projects, members, types, statuses, issues, comments, polling
- [x] Verify standardized error shape
- [x] Không chuyển sang frontend nếu backend regression test chưa pass

---

## Phase 6 — Frontend React

### 6.1 Frontend foundation

- [x] Khởi tạo React app
- [x] Tạo API client chung với cookie credentials
- [x] Tạo `AuthContext`
- [x] Tạo `useAuth`
- [x] Tạo route/navigation cơ bản

### 6.2 Pages

- [x] `LoginPage`
- [x] `ProjectListPage`
- [x] `ProjectBoardPage`
- [x] `IssueDetailPage`
- [x] `ProjectSettingsPage`

### 6.3 Components

- [x] `StatusColumn`
- [x] `IssueCard`
- [x] `IssueForm`
- [x] `CommentList`
- [x] `Navbar`
- [x] `RoleGuard`

### 6.4 Board/workflow behavior

- [x] Render board columns từ workflow statuses của project
- [x] Không hardcode global To Do/In Progress/Done behavior
- [x] Issue create/edit/status update gọi đúng API
- [x] Project settings quản lý members, issue types và workflow statuses theo role

### 6.5 Polling frontend

- [x] Tạo `usePolling`
- [x] Poll updates mỗi 5–10 giây
- [x] Dùng response `serverTime` làm mốc lần kế tiếp
- [x] Merge changed issues/comments vào state mà không reload toàn trang

### 6.6 Frontend build verification

- [x] `npm run build` thành công
- [x] Verify output ở `frontend/dist/`
- [x] Serve thử `frontend/dist/` bằng static server và kiểm tra không lỗi asset/runtime cơ bản

---

## Phase 7 — Source protection & device license

### 7.1 Source protection

- [x] Tích hợp `bytenode` cho các module backend nhạy cảm
- [x] Tích hợp `javascript-obfuscator` cho phần production backend còn lại
- [x] Tạo production build pipeline riêng, không phá dev source tree
- [x] Verify production artifact chạy được sau compile/obfuscation

### 7.2 Device fingerprint

- [x] Viết PowerShell host script lấy device fingerprint ổn định
- [x] Script chạy trên Windows host, không chạy trong Linux container
- [x] Xuất/đưa fingerprint vào `.env` dưới `HOST_FINGERPRINT`
- [x] Không log fingerprint plaintext

### 7.3 License validation

- [x] Implement license validation dựa trên `HOST_FINGERPRINT`
- [x] App từ chối chạy hoặc fail fast đúng thiết kế khi license không hợp lệ
- [x] Test valid fingerprint
- [x] Test invalid fingerprint
- [x] Test missing fingerprint

---

## Phase 8 — Production static artifact & Docker packaging

### 8.1 Frontend production artifact

- [x] Copy/sync build output từ `frontend/dist/` sang root `frontend-dist/`
- [x] Verify root `frontend-dist/` chứa đúng static production build
- [x] Không commit artifact nếu project policy không yêu cầu

### 8.2 Backend Dockerfile

- [x] Viết backend `Dockerfile` dùng Node LTS
- [x] Production image dùng protected/compiled backend artifact
- [x] Không copy raw sensitive backend source không cần thiết
- [x] Set `NODE_ENV=production`

### 8.3 Caddy

- [x] Viết `Caddyfile`
- [x] Serve root `frontend-dist/`
- [x] Reverse proxy `/api/*` → `app:3000`
- [x] Verify Caddy config parse/load thành công

### 8.4 Docker Compose

- [x] Service `db` dùng `postgres:16-alpine`
- [x] Service `app`
- [x] Service `caddy`
- [x] Internal network `app-net`
- [x] `restart: unless-stopped` cho mọi service
- [x] Không expose `5432` ra host
- [x] `app` có `mem_limit`
- [x] Secrets đọc từ `.env`
- [x] Production Postgres data bind-mount ra path host rõ ràng
- [x] `caddy_data` được persist phù hợp

### 8.5 Docker integration test

- [x] `docker compose build` thành công
- [x] `docker compose up -d` thành công
- [x] `docker compose ps` xác nhận `db`, `app`, `caddy` đều Up/healthy theo khả năng cấu hình
- [x] Test frontend qua Caddy
- [x] Test `/api/*` qua Caddy, không gọi thẳng app container để coi là E2E pass
- [x] Verify Postgres không reachable từ host qua port 5432

---

## Phase 9 — Backup & restore operations

### 9.1 Backup

- [x] Viết PowerShell backup script dùng `docker exec ... pg_dump -Fc`
- [x] Backup output vào `backups/`
- [x] File naming có timestamp
- [x] Script detect/report failure hợp lý

### 9.2 Rotation

- [x] Implement giữ 7–14 backup gần nhất
- [x] Test rotation với nhiều file giả/lịch sử

### 9.3 Restore proof

- [x] Tạo một `.dump` thật từ database test
- [x] Restore vào một PostgreSQL container/database sạch
- [x] Verify row counts/dữ liệu chính sau restore
- [x] Chỉ sau restore-test thành công mới đánh dấu backup/restore hoàn thành

### 9.4 Scheduler

- [x] Viết hướng dẫn/cấu hình Windows Task Scheduler chạy backup nightly
- [x] Test task/script chạy được dưới account dự kiến trên máy staging/khách khi có môi trường

### 9.5 Optional cloud sync

- [ ] Nếu khách đã dùng Google Drive/OneDrive và muốn bật: hướng dẫn sync thư mục `backups/`

---

## Phase 10 — Remote access (optional)

Chỉ thực hiện nếu khách cần truy cập ngoài LAN.

- [ ] Thêm `cloudflared` service vào `docker-compose.yml`
- [ ] Dùng Cloudflare Tunnel production với domain/hostname cố định
- [ ] Không dùng Quick Tunnel cho production
- [ ] Verify tunnel tới Caddy/app hoạt động
- [ ] Verify không cần port-forward trực tiếp từ router

---

## Phase 11 — Windows deployment & handover

### 11.1 Host preparation

- [x] Xác nhận Windows 10/11 machine đáp ứng yêu cầu
- [x] Kiểm tra virtualization/WSL2
- [x] Cài/cấu hình Docker Desktop hoặc phương án đã được người dùng phê duyệt
- [ ] Bật "Start Docker Desktop when you sign in"
- [ ] Disable Sleep/Hibernate

### 11.2 Client configuration

- [ ] Tạo `.env` thật từ `.env.example`
- [x] Sinh `HOST_FINGERPRINT`
- [x] Cấu hình production DB bind-mount path
- [ ] Cấu hình firewall đúng mode truy cập
- [ ] Autologin chỉ cấu hình nếu khách chấp nhận trade-off bảo mật

### 11.3 Production start

- [x] `docker compose up -d`
- [x] Verify toàn bộ required containers Up
- [x] Verify app truy cập được qua browser trong LAN hoặc hostname đã cấu hình
- [x] Verify authentication/RBAC/issue/comment flows smoke-test trên môi trường deployment

### 11.4 Reboot test — bắt buộc

- [ ] Reboot máy Windows thật hoặc môi trường tương đương
- [ ] Verify Docker tự start
- [ ] Verify containers tự lên lại nhờ `restart: unless-stopped`
- [ ] Verify app truy cập được sau reboot mà không cần thao tác thủ công ngoài cơ chế autologin đã được duyệt
- [ ] Verify database data vẫn còn nguyên

### 11.5 Handover

- [x] Bàn giao cách xem log: `docker compose logs -f`
- [x] Bàn giao cách restart stack
- [x] Bàn giao vị trí `.env`, DB data path và backups
- [x] Bàn giao cách chạy backup thủ công
- [x] Bàn giao quy trình restore cơ bản
- [x] Ghi rõ remote access configuration nếu có
- [x] Ghi rõ Docker Desktop licensing consideration nếu áp dụng

---

## Phase 12 — Approved Jira-style workspace expansion

> User-approved specification expansion dated 2026-08-22. This phase may be implemented before target-machine-only Phase 11 checks because it changes application functionality, not host preparation.

### 12.1 Authoritative documents

- [x] Update `RULES.md` with Jira-style UI, sidebar, pages, schema/API and RBAC requirements
- [x] Update both System Design documents with official schema, API, transaction, folder and deployment additions
- [x] Confirm the expansion keeps React/Express/PostgreSQL/Caddy/Docker and the existing layered architecture

### 12.2 Database migration

- [x] Add an idempotent migration for `sprints`, planning fields, `project_docs`, `project_forms`, `form_submissions`, and `development_links`
- [x] Update fresh-install `schema.sql` to create the official 14-table schema and indexes
- [x] Apply migration to a real PostgreSQL 16 database and verify tables, constraints, indexes, and existing data preservation

### 12.3 Backend APIs

- [x] Implement Summary aggregate API
- [x] Implement sprint and issue-planning APIs, including one-active-sprint transaction rule
- [x] Implement Development Links APIs
- [x] Implement Project Docs APIs
- [x] Implement Project Forms and submission APIs
- [x] Add backend unit/integration coverage for validation, ownership, RBAC, and data persistence

### 12.4 Jira-style React shell

- [x] Implement Jira-style dark design tokens, top bar, project header, functional project tabs, and collapsible sidebar
- [x] Restyle Login while preserving real email/password/register behavior
- [x] Keep all existing routes/board/issue/settings functionality compatible

### 12.5 Functional workspace pages

- [x] Implement functional Summary dashboard with real project aggregates
- [x] Implement functional Backlog with sprint/planning operations
- [x] Implement functional Timeline based on real issue dates
- [x] Implement functional Development view backed by development-links API
- [x] Implement functional Project Docs CRUD
- [x] Implement functional Project Forms definitions/submissions

### 12.6 Verification and packaging

- [x] Run complete backend unit and PostgreSQL integration suites successfully
- [x] Run frontend production build successfully and refresh `frontend-dist/`
- [x] Rebuild/start Docker Compose and verify health/API through Caddy
- [x] Browser-test login, sidebar collapse, every project tab, RBAC mutations, and existing board/issue/settings flows with no console errors

---

## Phase 13 — Approved board controls and admin account provisioning

> User-approved specification expansion dated 2026-08-22. This phase follows Phase 12 and does not alter the required stack or 14-table schema.

### 13.1 Authoritative documents

- [x] Update `RULES.md` and both System Design documents with the board controls, assignee lookup, sprint completion, and admin-only provisioning contract
- [x] Confirm public registration removal and use the existing project-admin RBAC model without adding a global-role table

### 13.2 Backend behavior

- [x] Require authentication plus existing project-admin authority for account creation; preserve bootstrap provisioning outside public UI
- [x] Add project-member assignee lookup by account name/email and enforce project membership for issue assignees
- [x] Add issue search and create fields for status/due date while preserving atomic key/history creation
- [x] Add transactional active-sprint completion that returns incomplete work to the backlog

### 13.3 Board and settings UI

- [x] Replace numeric assignee entry with account-name search in issue creation/editing
- [x] Add functional board search, filters, grouping, per-column inline create, and admin-only add-column controls
- [x] Add functional active-sprint completion action with returned result feedback
- [x] Remove public register UI and provide admin-only account provisioning in Project Settings

### 13.4 Verification and packaging

- [x] Add/adjust backend tests for authorization, assignee ownership, board query behavior, and sprint completion
- [x] Run backend unit/integration suites, frontend production build, Docker/Caddy API smoke tests, and refresh `frontend-dist/`

---

## Phase 14 — Approved Space creation and viewer isolation

> User-approved specification expansion dated 2026-08-22. “Space” is the product term; existing project storage/API identifiers remain for compatibility.

### 14.1 Authoritative documents

- [x] Update `RULES.md` and both System Design documents with Space terminology, admin-only creation, atomic viewer assignment, and isolation rules
- [x] Confirm no schema, stack, container, or architecture change is required

### 14.2 Backend authorization and assignment

- [x] Restrict Space creation and account search to authenticated admins
- [x] Add atomic `viewerIds` assignment during Space creation and roll back invalid assignments
- [x] Restrict new Space assignments to viewer role
- [x] Verify list/direct-access isolation and viewer mutation denial

### 14.3 Space UI

- [x] Replace project-facing list/create terminology with Space terminology
- [x] Hide Space creation from non-admin accounts
- [x] Add account-name selection for initial Space viewers and Settings viewer management
- [x] Update navigation labels and empty states to describe assigned Spaces

### 14.4 Verification and packaging

- [x] Add/update integration tests for admin-only creation, viewer-only assignment, rollback, isolation, and mutation denial
- [x] Run full backend integration suite, frontend build, Docker/Caddy smoke tests, and refresh `frontend-dist/`

---

## Phase 15 — Unified Space home and sidebar

> User-approved Jira-style navigation expansion dated 2026-08-22.

### 15.1 Authoritative documents

- [x] Update `RULES.md` and both System Design documents for the home route, shared Space list, sidebar creation, and Admin-wide scope
- [x] Confirm the existing `projects`/`project_members` schema and `/api/projects` compatibility routes remain unchanged

### 15.2 Backend visibility and authorization

- [x] Return every Space to application Admins and only assigned Spaces to non-admin accounts
- [x] Grant application Admins effective admin authorization on every Space/resource
- [x] Preserve `403` isolation and read-only access for unassigned/assigned non-admin accounts

### 15.3 Frontend navigation

- [x] Replace the rendered `/projects` page with `/` home and make `/projects` redirect to `/`
- [x] Route successful login to the home page
- [x] Render the same permitted Space list on home and in every workspace sidebar
- [x] Add Admin-only Create Space navigation and creation screen at `/spaces/new`
- [x] Expand only the active Space navigation while keeping other Spaces selectable

### 15.4 Verification and packaging

- [x] Add/update integration coverage for Admin-wide visibility/access and non-admin isolation
- [x] Run backend unit/integration suites and frontend production build
- [x] Deploy Docker/Caddy, smoke-test home/sidebar/create authorization, and refresh `frontend-dist/`

---

## Phase 16 — Issue completion tracking and assignment controls

> User-approved task-tracking and authorization expansion dated 2026-08-22.

### 16.1 Authoritative documents and schema

- [x] Update `RULES.md` and both System Design documents for completion dates, final-status locking, and self-assignment
- [x] Add `issues.completed_at`, date indexes, and an idempotent migration/backfill

### 16.2 Backend behavior

- [x] Add `created_on` and `completed_on` issue filters and return assignee names
- [x] Set/clear `completed_at` atomically with final/non-final status transitions
- [x] Reject all member field/planning/status mutations on completed issues
- [x] Restrict member assignment changes to self, unchanged assignment, or unassigned
- [x] Preserve Admin assignment, completed edit, and reopen authority

### 16.3 Frontend board and detail

- [x] Add Created on and Completed on day filters to the board
- [x] Display assignee below task title and created/completed dates on cards
- [x] Hide/disable completed issue editing for members while retaining Admin controls
- [x] Restrict member assignee choices to their own account

### 16.4 Verification and packaging

- [x] Add integration coverage for date filters, timestamp transitions, self-assignment, completed lock, and Admin override
- [x] Run backend unit/integration suites and frontend production build
- [x] Apply migration, deploy Docker/Caddy, run live smoke tests, and refresh `frontend-dist/`

---

## Phase 17 — Searchable assignee board filter

> User-requested usability enhancement dated 2026-08-22.

### 17.1 Specification and implementation

- [x] Document assignee-name typeahead behavior in `RULES.md` and the Core System Design
- [x] Use the project-member assignee lookup API while typing and filter visible board cards by the entered name
- [x] Apply exact assignee filtering when a suggestion is selected and support Everyone/Clear filters reset

### 17.2 Verification and packaging

- [x] Run the frontend production build successfully
- [x] Refresh `frontend-dist/` and verify the live Caddy-served bundle and health endpoint

---

## Completion rule


Dự án chỉ được coi là hoàn thành khi:

- tất cả item bắt buộc đã `[x]`;
- database/schema/API/frontend/Docker đều đã chạy test thật;
- atomic issue-key concurrency test pass;
- status-history transaction test pass;
- production artifact chạy được;
- Docker E2E qua Caddy pass;
- backup + restore test pass;
- Windows reboot test pass;
- mọi blocker/deviation đã được người dùng quyết định rõ.

Optional Phase 10 và các optional cloud-sync item không chặn completion nếu user xác nhận không dùng.
