# RULES.md — Quy tắc bắt buộc cho dự án Task/Issue Tracker (Jira-clone)

> File này là **technical source of truth** cho quá trình triển khai dự án.
> Nó phải được áp dụng cùng với:
> - `System_Design_Core_DB_API_Sequence_Folder_EN.md`
> - `System_Design_Addendum_Windows_Docker_Postgres.md`
> - `CHECKLIST.md`
>
> Nếu implementation hoặc yêu cầu phát sinh mâu thuẫn với các tài liệu trên, agent phải dừng lại,
> chỉ rõ mâu thuẫn và hỏi người dùng trước khi tự ý thay đổi kiến trúc.

---

## 1. Thứ tự ưu tiên tài liệu

Khi triển khai, áp dụng theo thứ tự:

1. `RULES.md` — các ràng buộc kỹ thuật bắt buộc.
2. `System_Design_Core_DB_API_Sequence_Folder_EN.md` — schema, API contract, sequence/transaction và folder architecture.
3. `System_Design_Addendum_Windows_Docker_Postgres.md` — deployment Windows + Docker + PostgreSQL và các lưu ý vận hành.
4. `CHECKLIST.md` — thứ tự thực thi và điều kiện hoàn thành.

`CHECKLIST.md` không được dùng để thay đổi hoặc giản lược specification trong System Design.

Nếu hai System Design có khác biệt về cách trình bày nhưng có thể cùng tồn tại, agent phải triển khai theo cách tương thích với cả hai.
Nếu không thể tương thích, phải hỏi người dùng.

---

## 2. Stack bắt buộc — không tự ý đổi

| Thành phần | Công nghệ bắt buộc | Không được tự ý dùng |
|---|---|---|
| Backend | Node.js LTS 20.x hoặc 22.x + Express | NestJS, Fastify hoặc framework backend khác |
| Database | PostgreSQL 16 (`postgres:16-alpine`) | MariaDB/MySQL |
| DB driver | `pg` | `mysql2`; ORM nặng như Prisma/TypeORM nếu chưa được duyệt |
| Frontend | React, build tĩnh bằng `npm run build` | Thay framework frontend nếu chưa được duyệt |
| Reverse proxy / HTTPS | Caddy (`caddy:2-alpine`) | Nginx/IIS |
| Deployment | Docker Compose | Cài app/db/proxy native trực tiếp trên Windows |
| Auth | JWT trong HttpOnly Cookie + `bcryptjs` | JWT trong `localStorage`; session store riêng nếu chưa được duyệt |
| Authorization | RBAC theo `project_members.project_role` | Chỉ kiểm soát quyền ở frontend |
| Realtime-like updates | Lightweight polling | Persistent WebSocket |
| Source protection | `bytenode` + `javascript-obfuscator` + device-bound license | Ship raw sensitive backend source trong production |

Không thêm dependency kiến trúc lớn như Redis, message queue, WebSocket, ORM lớn hoặc service mới nếu chưa được specification yêu cầu hoặc người dùng phê duyệt.

---

## 3. Kiến trúc backend bắt buộc

Backend phải tuân thủ dependency flow:

`routes → controllers → services → repositories`

### 3.1 Routes

- Chỉ khai báo path, middleware và controller.
- Không chứa business logic.
- Không chứa SQL.

### 3.2 Controllers

- Nhận request.
- Validate/normalize input ở mức HTTP.
- Gọi service.
- Format HTTP response.
- Không query database trực tiếp.
- Không gọi repository trực tiếp.

### 3.3 Services

- Chứa business logic.
- Không phụ thuộc vào `req` / `res`.
- Không chứa SQL trực tiếp.
- Gọi repositories.
- Các nghiệp vụ cần nhiều DB operation atomic phải mở transaction tại service thông qua helper kiểu `withTransaction`, sau đó truyền `tx` xuống repository.

### 3.4 Repositories

- Là tầng **duy nhất** được chứa SQL.
- Dùng `pg`/`pg.Pool` hoặc transaction client được truyền xuống.
- Mọi query có dữ liệu động phải parameterized (`$1`, `$2`, ...).

---

## 4. Database schema bắt buộc

Schema chính thức gồm **14 bảng** sau khi người dùng phê duyệt mở rộng Jira-style ngày 2026-08-22:

1. `users`
2. `projects`
3. `project_members`
4. `project_issue_sequences`
5. `issue_types`
6. `workflow_statuses`
7. `issues`
8. `issue_status_history`
9. `comments`
10. `sprints`
11. `project_docs`
12. `project_forms`
13. `form_submissions`
14. `development_links`

`issues` được mở rộng với `sprint_id`, `due_date`, `story_points`, `backlog_rank` và
`completed_at`. `completed_at` là `NULL` khi issue chưa hoàn thành, được đặt khi issue
vào status `is_final`, và được xoá khi Admin mở lại issue. Không tự thêm, bớt hoặc
đổi semantic của bảng nếu chưa được người dùng phê duyệt.

### 4.1 PostgreSQL conventions

- Primary key tự tăng: dùng `GENERATED ALWAYS AS IDENTITY`.
- Thời gian: dùng `TIMESTAMPTZ`.
- Metadata linh hoạt của issue: dùng `JSONB`.
- Status/priority cố định: dùng `CHECK` constraint hoặc PostgreSQL enum nếu specification thật sự yêu cầu.
- Query phải parameterized.
- Không nối chuỗi SQL từ user input.

### 4.2 `issue_types` và `workflow_statuses`

- Là cấu hình **theo từng project**, không phải global.
- `issue_types` có uniqueness theo `(project_id, name)`.
- `workflow_statuses` có `position`, `is_default`, `is_final`.
- Khi tạo project mới, service phải tạo:
  - row `project_issue_sequences` với `last_number = 0`;
  - bộ default issue types;
  - bộ default workflow statuses.
- Việc seed các default issue types/statuses này thuộc nghiệp vụ `POST /api/projects`, không phải seed global trong `seed.sql`.

### 4.3 `seed.sql`

`seed.sql` chỉ dùng cho dữ liệu mẫu/dev cần thiết để kiểm thử bootstrap database.

Không seed global issue types/workflow statuses vì chúng thuộc từng project.

Nếu seed một sample project để test, default issue types/statuses của sample project phải được tạo theo cùng invariants của nghiệp vụ tạo project, không được tạo một bộ global riêng.

---

## 5. Atomic issue key generation — bắt buộc

`issue_key` có dạng:

`<PROJECT_KEY>-<N>`

Ví dụ: `PROJ-1`.

Việc sinh số phải dùng `project_issue_sequences` và chạy trong **cùng một transaction** với việc insert issue và history ban đầu.

Luồng bắt buộc tương đương:

1. `BEGIN`
2. lock/read project key nếu cần (`SELECT ... FOR UPDATE`)
3. `UPDATE project_issue_sequences SET last_number = last_number + 1 WHERE project_id = $1 RETURNING last_number`
4. lấy default workflow status của project
5. insert `issues`
6. insert `issue_status_history` với `from_status_id = NULL`
7. `COMMIT`

Nếu có lỗi: `ROLLBACK`.

**Cấm** dùng pattern:

`SELECT current_number → calculate in app → UPDATE`

vì có race condition.

Logic này phải được concurrency-test trước khi checklist item tương ứng được đánh dấu hoàn thành.

---

## 6. Quy tắc đổi status issue

Đổi status phải nằm trong một transaction:

1. Lock/read status hiện tại của issue (`SELECT ... FOR UPDATE` hoặc tương đương an toàn).
2. Verify status mới thuộc cùng project của issue.
3. Update `issues.status_id` và `issues.updated_at`.
4. Insert một row vào `issue_status_history` với:
   - `from_status_id`
   - `to_status_id`
   - `changed_by`
5. Commit.

Không được update status mà không ghi history.

---

## 7. API contract

Base path: `/api`.

### 7.1 Authentication

Các endpoint bắt buộc:

- `POST /auth/register` (authenticated account provisioning only)
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

JWT:

- lưu trong HttpOnly Cookie tên `token`;
- không lưu token ở localStorage;
- `requireAuth` áp dụng cho mọi route trừ login. `POST /auth/register` còn yêu cầu
  người gọi đang đăng nhập và có ít nhất một membership `project_role = admin`.
  Public self-registration bị cấm. Tài khoản admin bootstrap được tạo bằng `seed.sql`
  hoặc quy trình triển khai được phê duyệt.

### 7.2 Projects

Product/UI terminology is **Space**. The existing `projects` table and `/projects`
API paths remain the compatibility/storage contract; frontend labels must not expose
"Create project". Only an authenticated user with at least one `admin` membership
may create a Space.

- `GET /projects`
- `POST /projects`
- `GET /projects/:projectId`
- `PATCH /projects/:projectId`
- `DELETE /projects/:projectId`

`POST /projects` accepts optional `viewerIds` and must add those existing accounts
as `viewer` memberships in the same transaction as Space creation/default setup.

Khi `POST /projects`:
- creator tự động thành `admin`;
- tạo sequence;
- seed default issue types;
- seed default workflow statuses;
- các bước liên quan phải giữ consistency, ưu tiên cùng transaction.

### 7.3 Project Members

- `GET /projects/:projectId/members`
- `POST /projects/:projectId/members`
- `PATCH /projects/:projectId/members/:userId`
- `DELETE /projects/:projectId/members/:userId`
- `GET /projects/:projectId/assignees?search=<account name or email>`

New Space assignments are viewer-only. Admin selects accounts; backend must reject
attempts to assign `member` or another `admin` through the assignment endpoints.
Legacy `member` rows may remain for backward compatibility, but they are not offered
by the Space-management UI.

### 7.4 Issue Types

- `GET /projects/:projectId/issue-types`
- `POST /projects/:projectId/issue-types`
- `PATCH /projects/:projectId/issue-types/:id`
- `DELETE /projects/:projectId/issue-types/:id`

Không cho xoá type đang được issue sử dụng; trả `409`.

### 7.5 Workflow Statuses

- `GET /projects/:projectId/workflow-statuses`
- `POST /projects/:projectId/workflow-statuses`
- `PATCH /projects/:projectId/workflow-statuses/:id`
- `PATCH /projects/:projectId/workflow-statuses/reorder`
- `DELETE /projects/:projectId/workflow-statuses/:id`

Không cho xoá status đang được issue sử dụng; trả `409`.

### 7.6 Issues

- `GET /projects/:projectId/issues`
- `POST /projects/:projectId/issues`
- `GET /issues/:issueKey`
- `PATCH /issues/:issueKey`
- `PATCH /issues/:issueKey/status`
- `DELETE /issues/:issueKey`

List issues phải hỗ trợ các query param đã định nghĩa trong System Design:
- `status_id`
- `assignee_id`
- `issue_type_id`
- `page`
- `pageSize`
- `search` (match case-insensitive against issue key or title)
- `created_on` (ISO date `YYYY-MM-DD`, lọc theo ngày tạo)
- `completed_on` (ISO date `YYYY-MM-DD`, lọc theo ngày hoàn thành)

Mọi issue response dùng cho board/detail phải trả `created_at`, `completed_at`,
`assignee_id` và `assignee_name`. Member chỉ được đặt assignee thành chính tài khoản
của mình (hoặc bỏ gán); Admin có thể gán bất kỳ project member nào.

Khi issue đang ở status `is_final`, mọi mutation field/planning/status của Member
phải bị backend từ chối `403 COMPLETED_ISSUE_LOCKED`. Chỉ Admin được sửa hoặc mở lại
issue hoàn thành. Khi chuyển vào final status, update issue và `completed_at` phải nằm
trong cùng transaction với status history.

### 7.7 Comments

- `GET /issues/:issueKey/comments`
- `POST /issues/:issueKey/comments`
- `PATCH /comments/:id`
- `DELETE /comments/:id`

Author/admin constraints phải được enforce ở backend.

### 7.8 Polling

Endpoint:

`GET /projects/:projectId/updates?since=<ISO timestamp>`

Response phải có `serverTime`.

Client dùng `serverTime` làm `since` cho lần poll tiếp theo.

Khuyến nghị polling interval: **5–10 giây**.

Không dùng persistent WebSocket.

### 7.9 Error shape

Lỗi API phải thống nhất:

```json
{
  "error": {
    "code": "...",
    "message": "..."
  }
}
```

### 7.10 Jira-style workspace expansion

Các endpoint bắt buộc của phần mở rộng:

- `GET /projects/:projectId/summary`
- `GET|POST /projects/:projectId/sprints`
- `PATCH|DELETE /projects/:projectId/sprints/:sprintId`
- `PATCH /issues/:issueKey/planning`
- `POST /projects/:projectId/sprints/:sprintId/complete`
- `GET|POST /projects/:projectId/development-links`
- `DELETE /projects/:projectId/development-links/:linkId`
- `GET|POST /projects/:projectId/docs`
- `GET|PATCH|DELETE /projects/:projectId/docs/:docId`
- `GET|POST /projects/:projectId/forms`
- `GET|PATCH|DELETE /projects/:projectId/forms/:formId`
- `POST /projects/:projectId/forms/:formId/submissions`
- `GET /projects/:projectId/forms/:formId/submissions`

Viewer được đọc workspace và gửi form. Member được quản lý planning, sprint, development links và docs. Admin có toàn quyền, đồng thời là role duy nhất được quản lý form definition và xoá các resource cấu hình. Mọi quyền vẫn phải được enforce ở backend.

---

## 8. RBAC bắt buộc

Roles:

- `admin`
- `member`
- `viewer`

Role được lấy từ `project_members.project_role`.

Backend phải enforce quyền thật sự thông qua middleware/service.

Frontend `RoleGuard` chỉ dùng để ẩn/hiện UI, không thay thế backend authorization.

Khi resolve quyền từ `issueKey`, backend phải xác định project sở hữu issue trước khi check role.

Space visibility uses two scopes. An account with at least one `admin` membership is
the application Admin and may list and administer every Space. All other accounts may
list and read only Spaces in which they have a `project_members` row; direct requests
to unassigned Space/resources must return `403`. Assigned non-admin accounts use
`viewer` and therefore have read-only access.

---

## 9. Frontend architecture

Frontend phải có tối thiểu:

- `LoginPage`
- `HomePage` at `/` for selecting a visible Space
- `CreateSpacePage` at `/spaces/new`, available only to Admins from the sidebar
- `ProjectBoardPage`
- `IssueDetailPage`
- `ProjectSettingsPage`
- `ProjectSummaryPage`
- `ProjectBacklogPage`
- `ProjectTimelinePage`
- `ProjectDevelopmentPage`
- `ProjectDocsPage`
- `ProjectFormsPage`

`/projects` is not a rendered page. It is compatibility-only and redirects to `/`.
After login the frontend routes to `/`. The Jira-style sidebar must use the same
`GET /projects` response as the home page, show every Space visible to the caller,
highlight/expand the current Space, and expose Create Space only to Admins.

Board render columns từ `workflow_statuses` của project, không hardcode workflow toàn hệ thống.

API client phải gửi cookie (`credentials: 'include'` hoặc `withCredentials` tương đương).

Polling nên được gom vào hook/service tương ứng như `usePolling`.

### 9.1 Jira-style shell và navigation

- Giao diện workspace dùng dark theme kiểu Jira, top bar, project header/tabs và sidebar trái có thể thu gọn.
- Sidebar phải điều hướng thực sự tới Projects/For you, Summary, Backlog, Board, Timeline, Development, Docs, Forms và Settings; không để control giả không có hành vi.
- Trạng thái thu gọn sidebar có thể lưu trong React state/localStorage; JWT vẫn tuyệt đối không được lưu trong localStorage.
- Summary phải lấy aggregate thật từ API; Backlog/Timeline/Development/Docs/Forms phải đọc/ghi dữ liệu thật theo RBAC.
- Không thêm chart framework lớn; ưu tiên CSS/SVG/HTML thuần.
- Login chỉ mô phỏng visual language của Jira và giữ email/password; public register UI/API bị loại bỏ. Chỉ project admin mới có thể tạo tài khoản qua settings; không thêm OAuth/social login nếu chưa được phê duyệt riêng.
- Board phải có server-backed search, assignee-by-account-name lookup/filter, filter/group controls, ngày tạo/ngày hoàn thành, inline create theo workflow column, admin-only add-column control, và complete-active-sprint action. Trường Assignee phải hỗ trợ gõ một phần hoặc toàn bộ tên account để lọc danh sách gợi ý và các card; chọn một gợi ý sẽ áp dụng bộ lọc chính xác, còn Everyone/Clear filters sẽ xoá bộ lọc. Card phải hiển thị assignee ngay dưới title cùng created/completed dates. Create issue phải hỗ trợ optional status, due date và project-member assignee; backend phải xác minh membership, self-assignment của Member và completed-lock.

### 9.2 Build output và production static folder

Để tương thích với cả hai System Design:

- Source frontend nằm trong `frontend/`.
- `npm run build` tạo build output tiêu chuẩn ở `frontend/dist/`.
- Khi đóng gói/deploy production, static artifact được copy/sync sang root `frontend-dist/`.
- Caddy production serve root `frontend-dist/`.

Không coi `frontend/dist/` và `frontend-dist/` là hai frontend khác nhau:
`frontend/dist/` là build output của source project; `frontend-dist/` là artifact phục vụ deployment/handover.

---

## 10. Docker rules

Các service chính:

- `db`
- `app`
- `caddy`
- optional `cloudflared`

Tất cả service production phải có:

`restart: unless-stopped`

### 10.1 Network

- Dùng internal network `app-net`.
- `app` kết nối DB qua `db:5432`.
- Không expose PostgreSQL port `5432` ra host.

### 10.2 App container

- Node.js LTS.
- Không cài PM2.
- `NODE_ENV=production`.
- Có `mem_limit`.

### 10.3 Postgres data

Production ưu tiên bind-mount `pgdata` ra path rõ ràng trên Windows host, ví dụ:

`D:\taskapp-data\pgdata`

Named volume chỉ được dùng cho môi trường test/dev hoặc khi người dùng phê duyệt rõ.

### 10.4 Secrets

`.env` chứa secrets:

- DB password
- JWT secret
- license/fingerprint values
- các secret deployment khác

`.env`:
- không commit git;
- không hardcode vào Dockerfile;
- không hardcode trực tiếp vào compose.

---

## 11. Caddy / HTTPS

Caddy chạy bằng `caddy:2-alpine`.

Vai trò:

- serve static frontend production artifact;
- reverse proxy `/api/*` tới `app:3000`;
- HTTPS / certificate management theo deployment environment.

Nếu môi trường dev/staging không có domain phù hợp cho public HTTPS, agent phải test reverse proxy theo cách khả thi và ghi rõ giới hạn thay vì fake HTTPS success.

---

## 12. Source protection & device-bound license

Production backend:

- sensitive modules compile bằng `bytenode`;
- phần còn lại obfuscate bằng `javascript-obfuscator`;
- không ship raw sensitive `.js` source nếu production packaging không yêu cầu.

Device fingerprint:

- lấy ở Windows host;
- truyền vào app container qua `HOST_FINGERPRINT`;
- không gọi `wmic`, `Get-CimInstance` hoặc Windows API từ Linux container để lấy host fingerprint;
- không log fingerprint/license key plaintext.

Approach mặc định: PowerShell host script tạo fingerprint và đưa vào `.env`.

---

## 13. Backup / restore

Backup:

- PostgreSQL `pg_dump -Fc`;
- gọi qua `docker exec` từ PowerShell;
- chạy định kỳ bằng Windows Task Scheduler;
- giữ 7–14 bản gần nhất.

Không được đánh dấu backup hoàn thành chỉ vì tạo được `.dump`.

Bắt buộc có ít nhất một **restore test thật** vào PostgreSQL sạch và verify dữ liệu trước khi bàn giao.

---

## 14. Windows deployment rules

Target chính:

Windows 10/11 always-on PC, Docker Desktop dùng WSL2 backend.

Cần kiểm tra/thiết lập theo deployment phase:

- virtualization / WSL2;
- Docker Desktop start on sign-in;
- disable Sleep/Hibernate;
- `restart: unless-stopped`;
- autologin chỉ nếu khách đồng ý trade-off bảo mật;
- Windows Defender Firewall;
- reboot test thật.

Nếu Docker Desktop licensing không phù hợp với khách hàng, không tự đổi phương án; báo người dùng để quyết định Docker Business hoặc phương án Docker Engine + Compose trên WSL2.

---

## 15. Remote access

Không port-forward trực tiếp app ra Internet.

Nếu cần remote access:

- dùng Cloudflare Tunnel;
- `cloudflared` chạy trong Docker Compose;
- production dùng hostname/domain cố định;
- không dùng Quick Tunnel làm production endpoint.

Nếu chỉ dùng Tunnel, không cần inbound firewall port.

Nếu truy cập LAN trực tiếp qua HTTPS, mở đúng port cần thiết (thường 443).

---

## 16. Quy tắc thực hiện task của agent

1. Trước khi code, đọc `RULES.md`, `CHECKLIST.md` và phần System Design liên quan.
2. Xác định đúng Phase + checklist item.
3. Inspect code hiện tại trước khi tạo/sửa file.
4. Không nhảy phase nếu dependency trước chưa hoàn thành, trừ khi người dùng yêu cầu.
5. Implement.
6. Chạy test/build/container/API/SQL thật tương ứng.
7. Nếu fail: sửa và chạy lại.
8. Chỉ sau khi PASS mới đổi `[ ]` → `[x]`.
9. Báo rõ:
   - Phase hiện tại;
   - item vừa hoàn thành;
   - test đã chạy;
   - item tiếp theo;
   - blocker/deviation nếu có.

Không được đánh dấu hoàn thành chỉ dựa trên suy đoán kiểu “should work”.

---

## 17. Design deviation

Nếu cần lệch khỏi rules/system design, phải báo:

`DESIGN DEVIATION REQUIRED`

và nêu:

1. Quy định hiện tại.
2. Vấn đề thực tế.
3. Thay đổi đề xuất.
4. Ảnh hưởng.
5. Chờ người dùng xác nhận.

Không tự thay đổi trước khi được duyệt.
