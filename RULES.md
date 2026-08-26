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

Schema chính thức gồm **17 bảng** sau các mở rộng report attachments và settings đã được duyệt:

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
15. `issue_attachments`
16. `user_preferences`
17. `system_settings`

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
- `DELETE /auth/users/:userId` (Admin soft-delete/deactivation only)

JWT:

- lưu trong HttpOnly Cookie tên `token`;
- không lưu token ở localStorage;
- `requireAuth` phải kiểm tra account vẫn active trên mỗi request để token cũ của
  account đã bị deactivate không tiếp tục truy cập được;
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

Space Settings must expose an Admin-only Space details form backed by
`PATCH /projects/:projectId`. Admins may change `name` (1–200 trimmed characters)
and set or clear `description` (maximum 10,000 characters). The Space `key` is
immutable so existing issue keys and URLs remain stable. A successful rename must
refresh the active header, sidebar Space list, home selector, and later API reads;
members and viewers must receive `403` for direct update attempts.

`POST /projects` accepts the backward-compatible optional `viewerIds` field and must
add those selected accounts as editable `member` memberships in the same transaction
as Space creation/default setup.

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

New Space assignments are `member` access by default. Admin selects accounts; the
backend must reject attempts to grant `admin` or new `viewer` assignments through
the Teams access controls. Existing explicit `viewer` rows remain readable and
read-only for backward compatibility.

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

Comments API và dữ liệu cũ được giữ để tương thích, nhưng Issue Detail không còn hiển thị comment composer. Khu vực này được thay bằng **Report links**:

- `GET /issues/:issueKey/attachments`
- `POST /issues/:issueKey/attachments` nhận JSON `{ url, title? }`
- `GET /attachments/:id/download` chỉ giữ cho binary attachment cũ
- `DELETE /attachments/:id`

Link mới phải là HTTPS tuyệt đối, tối đa 2048 ký tự. Backend chỉ lưu URL và metadata, tuyệt đối không tải file từ xa. Viewer được list/mở link. Member được thêm link và chỉ xoá link do chính mình thêm khi issue chưa final. Khi issue ở final status, mọi add/delete của non-admin phải trả `403 COMPLETED_ISSUE_LOCKED`; Admin vẫn được add/delete. Binary attachment cũ được giữ để tương thích, không tự động xoá.

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

Space visibility uses two scopes. Application Admin/Overall Admin accounts may list
and administer every Space. All other accounts may list only Spaces in which they
have a `project_members` row; direct requests to unassigned Space/resources must
return `403`. A `member` row permits the approved non-admin mutations while an
explicit legacy `viewer` row remains read-only.

Account removal is a soft delete. Admin may deactivate Member accounts; Overall
Admin may deactivate Member or Admin accounts. Self-deactivation and deactivation of
the Overall Admin are forbidden. Deactivation sets `users.deactivated_at` and
`users.deactivated_by`, removes current `project_members` access, rejects all future
login/authenticated requests, and excludes the account from active account/assignee
searches. The `users` row must never be hard-deleted: issue reporter/assignee,
status-history, comment, attachment, document, form, sprint, development, and Space
creator attribution must remain queryable.

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
- Login chỉ mô phỏng visual language của Jira và giữ email/password; public register UI/API bị loại bỏ. Account provisioning và phân quyền truy cập Space phải nằm trong trang Admin riêng `/teams`, không nằm trong settings của một Space. Chỉ application Admin được tạo tài khoản, gán account hiện có vào một hoặc nhiều Space với quyền member có thể chỉnh sửa công việc, hoặc thu hồi các assignment không phải admin; không thêm OAuth/social login nếu chưa được phê duyệt riêng.
- Settings của mỗi Space phải cho Admin tạo, đổi tên, đổi màu và xoá issue type; tạo, đổi tên, sắp xếp workflow status, chọn đúng một default status, đánh dấu final/completed status và xoá status. Mọi thao tác phải dùng API theo `projectId`; backend phải chặn xoá type/status đang được issue sử dụng bằng `409`.
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

---

## 18. Settings, Space services, and templates (approved 2026-08-23)

This section supersedes the earlier “no templates/additional tables” limitation.
The stack remains React + Express + PostgreSQL; no external marketplace service or
new runtime dependency is allowed.

- Every authenticated account may open **General settings** and **Notification settings**.
- General settings persist language and time zone and provide a current-password-protected password change.
- A saved language preference is loaded for every authenticated session, sets the document locale, and applies to the entire authenticated UI (navigation, Space views, work-item screens, forms, and settings); changing it must not require a manual refresh.
- Notification settings persist email and in-app notification preferences.
- Only an application Admin may open **System**, **Apps**, **Spaces**, and **Work items** settings or call their management APIs.
- System settings persist instance name, default language/time zone, and global notification availability.
- Apps settings persist the globally enabled built-in services: `development`, `timeline`, `docs`, and `forms`.
- Space settings list/search every Space, link to its settings, and expose template-based creation.
- Work-items settings provide an Admin reference/entry point to each Space's issue types and workflow statuses.

Built-in Space templates are code-owned, read-only definitions: `kanban`, `scrum`,
`work_requests`, `business`, and `personal`. Each specifies initial issue types,
workflow statuses, and enabled services/views. `POST /projects` accepts
`templateKey` plus an optional `enabledFeatures` subset. Space creation must still
seed membership, sequence, types, and statuses in one transaction. `projects.key`
remains immutable. Per-Space enabled features are persisted in JSONB and determine
which header/sidebar routes are displayed; `summary` and `board` are mandatory.

The official schema contains 17 tables after adding `user_preferences` and
`system_settings`, plus `projects.template_key` and `projects.enabled_features`.
Migration 005 must be idempotent and safe for existing Spaces.

---

## 19. Account-level administration roles (approved 2026-08-24)

- `users.account_role` is the source of truth for application-wide authority and is limited to `overall_admin`, `admin`, and `member`.
- Exactly one `overall_admin` exists. It cannot demote itself and is the only role allowed to grant or revoke the `admin` account role.
- `admin` accounts may create Member accounts and administer Spaces, but cannot grant, revoke, or alter application-wide Admin authority.
- Account roles are independent from `project_members.project_role`. Global Admins receive effective Admin access to all Spaces; Member accounts see only assigned Spaces.
- Revoking an account's global Admin role atomically downgrades its remaining Space-admin memberships to member so no Admin privilege survives while normal task editing remains available.
- Account creation explicitly chooses `member` or, when performed by the Overall Admin, `admin`. Public self-registration remains prohibited.
- Role mutation must be enforced by the backend; hiding frontend controls is insufficient.

---

## 20. Password-change completion semantics (approved correction 2026-08-24)

- `PATCH /api/settings/me/password` verifies the current password, stores the new bcrypt hash, and returns `204` only after the database update succeeds.
- The frontend must capture a stable reference to the submitted form before awaiting the API. It may clear password inputs only after the `204` response and must then show success, not a client-side reset error.
- A client rendering/reset failure after an API success does not roll back the password update. Error messaging must never imply that the old password remains valid after the server has accepted the change.

---

## 21. Atlassian-style Space directory (approved 2026-08-24)

- The authenticated `/` home remains the canonical Space selector and continues to use `GET /api/projects`, so Admins see every Space and Members see only assigned Spaces.
- Replace the card gallery with an Atlassian-style directory containing a compact heading, Admin-only Create Space action, template-panel toggle, local Space search, template/category filter, sortable name column, and a Space table.
- Every displayed Space row must open the correct existing Space. Row actions may expose Space settings only when the caller has effective Admin access.
- The template preview rail uses the existing code-owned templates and links into the existing `/spaces/new` flow. It must not introduce external services, schema changes, or new dependencies.
- The Jira-style shared sidebar and all existing RBAC rules remain unchanged.

---

## 22. Monthly Backlog archive (approved 2026-08-25)

- Each Space Backlog provides a month archive derived from the immutable
  `issues.created_at` timestamp. Grouping an issue into a month is a presentation
  rule and must not rewrite its creation date, sprint, workflow status, or history.
- `/projects/:projectId/backlog?month=YYYY-MM` opens the selected month's Backlog.
  With no month query, the newest available month is selected; `month=all` provides
  the complete Backlog.
- Month counts and month contents must be computed from the complete paginated
  issue result, not only the first API page. This prevents older work from silently
  disappearing after a Space exceeds 100 issues.
- Within a selected month, existing sprint groups, planning controls, completed-task
  locks, and Space RBAC remain unchanged.
- The month archive is available to every account that can access the Space. It does
  not add a new permission, database table, runtime dependency, or external service.

---

## 23. External report links (approved 2026-08-25)

This section supersedes the binary-upload requirements in section 7.7 for all new
reports. Existing binary attachments remain readable and removable for backward
compatibility; the application must not delete them automatically.

- New issue reports are HTTPS links to online Excel, Word, PDF, or other document
  viewers. PostgreSQL stores only the URL, display title, detected provider/type,
  uploader, and timestamps—never downloaded remote document bytes.
- `POST /issues/:issueKey/attachments` accepts JSON `{ url, title? }`. The backend
  validates an absolute HTTPS URL, limits it to 2048 characters, derives safe display
  metadata, and never fetches the remote URL (preventing SSRF and database growth).
- Report links render as document preview cards. Clicking a card opens the supplied
  URL in a new browser tab with opener isolation. The UI does not claim the remote
  document is available or safe beyond validating its URL scheme.
- Viewer may list/open links. Member may add links and remove only links they added.
  On final-status issues, non-Admin add/remove requests return
  `403 COMPLETED_ISSUE_LOCKED`; Admin retains override authority.
- Migration 009 makes legacy binary columns nullable and adds `external_url` and
  `provider` without adding a table. Each row must contain exactly one source:
  either a legacy binary or an external URL.

---

## 24. Monthly Backlog report index (approved 2026-08-25)

This section supersedes section 22's Backlog rendering and routing behavior.

- `/projects/:projectId/backlog` is a read-only month index derived from the
  complete paginated issue result and each issue's immutable `created_at` value.
- The Backlog page keeps its monthly title but removes sprint creation, sprint
  planning fields, individual issue rows, and sprint buckets. It displays one
  compact entry per month with the localized month name and issue count.
- A month entry links to `/projects/:projectId/board?month=YYYY-MM`. The Board
  applies that creation-month scope before assignee, priority, status, and search
  filters, then renders the full monthly report in the existing Kanban columns.
- An absent or invalid `month` query preserves the normal all-issues Board. A
  valid month is bookmarkable and displays an explicit monthly-report banner with
  a link back to the month index.
- Month navigation does not change issue dates, workflow state, permissions,
  completed-task locking, persistence, API contracts, or runtime dependencies.

---

## 25. Yearly report-calendar Backlog (approved 2026-08-25)

This section supersedes section 24's month-only list while retaining the same
read-only reporting and authorization boundaries.

- `/projects/:projectId/backlog` provides a report-year selector and twelve
  horizontally scrollable month tabs. Selecting a year or month redraws the table
  without changing issue data.
- The table contains an expandable row for the current Space, followed by one row
  per issue created in the selected month. Fixed columns show the report task,
  assignee, and workflow status; the scrollable calendar contains every day in the
  selected month.
- The expandable Space row is outside the horizontal calendar scroller and must
  remain fixed across the visible table width. Horizontal scrolling synchronizes
  the day header with issue rows only.
- An issue's immutable `created_at` determines its year, month, and report-day cell.
  That cell links to `/issues/:issueKey`, where authorized users can view the task's
  online report links. No report link is fetched or embedded in the Backlog.
- Year/month selection must be derived from the complete paginated issue result,
  remain usable when a month has no reports, and be represented in the URL as
  `?year=YYYY&month=M` for reload-safe reference.
- The calendar is a responsive presentation layer only. It adds no persistence,
  API, permission, workflow, or completed-task behavior.
- Each day header is interactive. Selecting a day limits the report rows to issues
  created on that local calendar day; selecting it again clears the day filter.
- The Backlog also provides assignee and workflow-status selectors. Day, assignee,
  and status filters compose together and are stored in the URL query so the
  filtered report remains reload-safe. Filtering never changes task ownership or
  workflow state.
- The assignee selector is an Excel-style searchable checklist rather than a
  single-result combobox. Typing only narrows the visible checklist; it must not
  discard already checked people. The menu includes Select All and Unassigned
  where applicable, supports multiple assignees, and commits changes only through
  Apply. Cancel or dismiss restores the currently applied selection.
- Applied assignees are reload-safe in the existing `assignee` query as a
  comma-separated set of account IDs and optional `unassigned`. An absent value
  means Everyone. Status/day filters continue to compose with this selection.
- The Backlog also provides a Task checklist with the same search, multi-select,
  Select All, Apply, Cancel, and dismissal behavior. It matches task title and
  issue key locally. Applied task IDs are stored as a comma-separated `task`
  query and compose with person, status, and report-day filters.

---

## 26. Kanban searchable multi-person filter (approved 2026-08-25)

- The Kanban Assignee control uses the same searchable checklist interaction as
  the report Backlog: multiple checked people, Select All, optional Unassigned,
  and explicit Apply/Cancel actions.
- Search text narrows the visible checklist locally and never changes the applied
  board filter or removes hidden checked people. Apply commits the draft; Cancel
  and outside dismissal restore the last applied selection.
- The checklist composes with board text, status, priority, creation/completion
  dates, monthly scope, and grouping. It does not change assignees, permissions,
  issue data, or the Kanban grouping/sorting order.
