# System Design Addendum — Deployment on a Windows PC with Docker + PostgreSQL

**Replaces:** the previous Synology DS216j approach *and* the previous Windows PC with natively installed services approach
**Applies to:** a client who has an existing always-on Windows 10/11 machine with mid-range specs (8–16GB RAM)
**Unchanged from the original document:** the entire Database Schema (section 3, syntax converted to PostgreSQL — see section 4 below), the Issue Key generation logic (implementation adjusted), the RBAC business flow, the JWT/bcryptjs strategy, the source-code protection strategy (bytenode + obfuscator + device-based license key — with an adjustment to how the fingerprint is obtained when running inside a container, see section 5.3).

---

## 1. Why switch to Docker + PostgreSQL

| | MariaDB + native install (old) | PostgreSQL + Docker (new) |
|---|---|---|
| Client-side setup | Install each piece separately: Node, MariaDB MSI, Caddy, PM2 — many manual steps, error-prone | `docker compose up -d` — a single command, a pre-packaged environment |
| Update / rollback | Update each component individually, hard to roll back | Change the image tag, `docker compose up -d` again; rollback = revert the tag to the old version |
| Isolation from the client's machine | The app runs directly on the client's OS, easily conflicting with other software | Each service runs in its own container, not touching whatever Node/DB version already exists on the client's machine (if any) |
| Consistency between dev and client environments | The dev machine and the client machine can drift in Node/DB versions | Identical images between dev and production |
| JSON, advanced data constraints | MariaDB's JSON support is more limited | PostgreSQL's JSONB is more powerful, useful if flexible custom fields/metadata for issues are needed later |
| Overhead | No virtualization layer | Docker Desktop adds roughly 1–2GB of background RAM usage — still fine on an 8–16GB machine |

**Trade-off to keep in mind:** Docker Desktop on Windows uses the WSL2 backend, which requires virtualization (Hyper-V/VM Platform) to be enabled in the BIOS/Windows Features — for a "typical" client machine, this is a setup step that needs careful checking, as it isn't always enabled by default. In addition, **Docker Desktop has licensing terms**: free for individuals, small businesses (<250 employees, <$10 million/year revenue), and educational/non-profit use; if the client is a larger business, a Docker Business subscription is required — the client's scale should be clarified before committing to this approach, or consider using Docker Engine + the Docker Compose plugin directly on WSL2 (without the Docker Desktop GUI) to avoid the licensing question entirely, at the cost of being less convenient to operate/update for a client who isn't technically savvy.

---

## 2. Overall architecture

```
┌──────────────────┐        HTTPS         ┌───────────────────────────────────────────────────────────┐
│  Browser          │ ────────────────────▶│              WINDOWS 10/11 PC (Always-On)                   │
│  (LAN or remote)   │                       │              Docker Desktop (WSL2 backend)                  │
└──────────────────┘                       │                                                               │
                                            │  docker compose stack (internal network: app-net)            │
                                            │  ┌─────────────────────────────────────────────────────┐    │
                                            │  │ caddy (container)                                     │    │
                                            │  │  - host port 443 → container 443/80                  │    │
                                            │  │  - reverse proxy /api/* → app:3000                    │    │
                                            │  │  - serves the static React build                     │    │
                                            │  │  - volume: caddy_data (HTTPS certificates)            │    │
                                            │  │  - restart: unless-stopped                           │    │
                                            │  └───────────────────┬────────────────────────────────┘    │
                                            │                      │                                       │
                                            │  ┌───────────────────▼────────────────────────────────┐    │
                                            │  │ app (container, image built from its own Dockerfile) │    │
                                            │  │  - Node.js LTS + Express, internal port 3000          │    │
                                            │  │  - connects over app-net to db:5432                  │    │
                                            │  │  - restart: unless-stopped                           │    │
                                            │  │  - NO LONGER needs PM2 (Docker restarts on crash)    │    │
                                            │  └───────────────────┬────────────────────────────────┘    │
                                            │                      │                                       │
                                            │  ┌───────────────────▼────────────────────────────────┐    │
                                            │  │ db — postgres:16-alpine (container)                  │    │
                                            │  │  - internal port 5432 (not exposed to host)          │    │
                                            │  │  - volume: pgdata (bind mount or named volume)       │    │
                                            │  │  - restart: unless-stopped                           │    │
                                            │  └────────────────────────────────────────────────────┘    │
                                            │                                                               │
                                            │  (optional) cloudflared (container) — Cloudflare Tunnel      │
                                            └───────────────────────────────────────────────────────────┘
```

### Technology choices and reasoning (updated)

- **Docker Compose** replaces separate native installs + PM2 + a standalone Windows Service: a single `docker-compose.yml` file describes the entire stack (db, app, reverse proxy, tunnel); the client only needs to install Docker Desktop once, then `docker compose up -d` runs the whole system — and it automatically restarts in the correct dependency order (`depends_on`) after a reboot.
- **PostgreSQL 16 (image `postgres:16-alpine`)** replaces MariaDB: an official, lightweight (Alpine) image, a stable recent version. `alpine` keeps the image small, which downloads faster on client networks that aren't always fast.
- **Caddy** still serves as the reverse proxy + auto-HTTPS as in the previous version, but now runs in a container instead of being installed directly on Windows — official image `caddy:2-alpine`.
- **PM2 is no longer needed**: the Docker container already has an equivalent `restart: unless-stopped` mechanism, and logs are already available via `docker logs`/`docker compose logs -f`, making PM2 a redundant layer. The production image build should still use `NODE_ENV=production` and limit the container's RAM via `mem_limit` in the compose file (equivalent to the old `--max-memory-restart` role).

---

## 3. Windows + Docker-specific operational notes

### 3.1 "Always on" still requires ensuring Docker Desktop starts automatically

- Enable the **"Start Docker Desktop when you sign in"** option in Docker Desktop's Settings.
- Because Docker Desktop needs a signed-in user to run (on a regular Windows edition, not Windows Server), the recommendation is: configure the client machine for **autologin** into the Windows account that has Docker installed, combined with a separate screen-lock policy if display security is needed — this is an important difference from the previous pure Windows Service version (which did not require a signed-in user).
- Disable Sleep/Hibernate (Power Options → Never) as before — still mandatory.
- In `docker-compose.yml`, set `restart: unless-stopped` for all 3 services (`db`, `app`, `caddy`) so Docker automatically restarts the containers after Docker Desktop/Windows restarts.
- A small UPS is still recommended as before, and is even more important now with Postgres (WAL writes) in the event of a sudden power loss.

### 3.2 Folder structure & sample files delivered to the client

```
project-root/
├── docker-compose.yml
├── .env                     # environment variables: DB password, JWT secret, etc.
├── Caddyfile
├── backend/
│   ├── Dockerfile
│   └── ... (obfuscated/bytenode-compiled source code)
├── frontend-dist/           # output of React's `npm run build`, served as static files by Caddy
└── backups/                 # where nightly pg_dump backups are stored
```

Abbreviated `docker-compose.yml` example:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: taskapp
      POSTGRES_USER: taskapp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [app-net]

  app:
    build: ./backend
    restart: unless-stopped
    depends_on: [db]
    environment:
      DATABASE_URL: postgres://taskapp:${DB_PASSWORD}@db:5432/taskapp
      JWT_SECRET: ${JWT_SECRET}
    mem_limit: 400m
    networks: [app-net]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["443:443", "80:80"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./frontend-dist:/srv/frontend-dist
      - caddy_data:/data
    depends_on: [app]
    networks: [app-net]

volumes:
  pgdata:
  caddy_data:

networks:
  app-net:
```

### 3.3 PostgreSQL tuning for 8–16GB RAM (replacing the old InnoDB table)

For example, on an 8GB machine, allocating ~1.5–2GB to the DB, set via `command:` in the compose file or a `postgresql.conf` file mounted into the container:

```
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 8MB
maintenance_work_mem = 128MB
max_connections = 100
wal_buffers = 16MB
```

Compared to `innodb_buffer_pool_size` in the MariaDB version, `shared_buffers` is the closest equivalent parameter. There's no need to set anything special for `performance_schema` as with MariaDB — PostgreSQL has the `pg_stat_statements` extension if query performance monitoring is needed later; it can be enabled without much extra RAM cost.

### 3.4 Backups with `pg_dump`

Replace `mysqldump` with `pg_dump`, run via `docker exec` from a PowerShell script called nightly by Task Scheduler:

```powershell
docker exec taskapp-db-1 pg_dump -U taskapp -Fc taskapp > backups\taskapp_$(Get-Date -Format yyyyMMdd_HHmmss).dump
```

- `-Fc` (custom format) allows selective table restores and is compressed already, making it more compact than a plain SQL dump.
- Still keep the rule of rotating the 7–14 most recent backups and syncing the `backups/` folder to Google Drive/OneDrive as before.
- It's recommended to bind-mount the `pgdata` folder (instead of a hidden named Docker volume) to an explicit path on the client's disk (e.g., `D:\taskapp-data\pgdata`), so that a physical-disk backup (if the client is in the habit of backing up the whole D: drive) also incidentally backs up the DB data.

### 3.5 Remote access / Cloudflare Tunnel

The same recommendation to use a Cloudflare Tunnel instead of port-forwarding still holds, but now `cloudflared` runs as a **container** within the same `docker-compose.yml` (image `cloudflare/cloudflared`) instead of being installed as a separate Windows Service — simplifying handover, since the client only needs a single `docker compose up -d` command for the entire system, tunnel included.

### 3.6 Windows Defender Firewall

Unchanged from before: open inbound 443 if accessed directly over the LAN; no port needs to be opened if only the Cloudflare Tunnel is used (outbound-only).

---

## 4. Database schema adjustments: MariaDB → PostgreSQL

The 8-table structure stays the same (`users`, `projects`, `project_members`, `project_issue_sequences`, `issue_types`, `workflow_statuses`, `issues`, `issue_status_history`, `comments`), but the syntax needs to be converted:

| MariaDB | PostgreSQL |
|---|---|
| `INT AUTO_INCREMENT PRIMARY KEY` | `SERIAL PRIMARY KEY` or `GENERATED ALWAYS AS IDENTITY` (IDENTITY is recommended, as it's more SQL-standard) |
| `DATETIME` | `TIMESTAMPTZ` (recommended to use a timezone-aware type instead of plain `TIMESTAMP`) |
| `ENUM('todo','in_progress','done')` | There's no convenient ENUM the same way MariaDB has it — use a `CHECK` constraint on a `TEXT`/`VARCHAR` column, or create a separate `CREATE TYPE ... AS ENUM (...)` if a stricter DB-level constraint is wanted |
| `LAST_INSERT_ID()` trick for generating `issue_key` | PostgreSQL has no `LAST_INSERT_ID()`. Replace with one of two approaches: (1) a separate `SERIAL`/`IDENTITY`-style counter per project in the `project_issue_sequences` table, using `UPDATE ... RETURNING` within the same transaction to safely (atomically) get the next number; or (2) a separate `CREATE SEQUENCE` per project, calling `nextval()`. Approach (1) is closer to the original design — it only requires changing the syntax: `UPDATE project_issue_sequences SET last_number = last_number + 1 WHERE project_id = $1 RETURNING last_number;` |
| `JSON` (limited support) | `JSONB` — if the original document intended to store flexible issue metadata, this is an area to take further advantage of compared to the old design |
| Node.js driver: `mysql2` | Driver: `pg` (or `postgres.js`/`pg-promise`, depending on preference) — the entire data access layer needs to change, and parameterized statements change from `?` to `$1, $2, ...` |

**Important note:** because `issue_key` generation now uses a transaction + `RETURNING` instead of `LAST_INSERT_ID()`, the entire issue-creation code path needs to be reviewed to ensure it still stays within a single transaction (BEGIN...COMMIT) between incrementing `last_number` and inserting into the `issues` table, to avoid a race condition when multiple users create issues concurrently — this atomicity principle is unchanged from the original; only the implementation syntax changes.

---

## 5. What stays the same / gets lightly adjusted from the original design

- **RBAC via `project_role`**: the logic is unchanged, only the query layer changes to Postgres syntax.
- **JWT in an HttpOnly Cookie + `bcryptjs`**: unchanged, runs exactly the same inside the Node container.
- **5.3 — Source-code protection (device-based license key) when running in Docker:** this is the most important point to note when moving to a container. Previously, the `Windows Machine GUID`/`Volume Serial Number` was read directly from the host OS. Inside a container, the Node code runs within a Linux container (its own namespace), so it **cannot directly obtain** the Windows host's Machine GUID via `wmic`/`Get-CimInstance` as before. One of two approaches is needed:
  1. Read the fingerprint from the **host** (a small PowerShell script run at build/deploy time, or run outside the container via an entrypoint that calls out) and pass it into the container via an environment variable (`.env` → `HOST_FINGERPRINT=...`) at startup — simple, but requires a manual/scripted fingerprint-generation step when setting up the client machine.
  2. Bind-mount a Windows-host-specific folder containing a stable identifier (e.g., a registry export file) into the container in read-only mode, and read from there instead of calling an OS API.
  Approach 1 is simple and sufficient for machine-based license-locking purposes; it should be chosen unless there's a requirement for stronger anti-tampering.
- **The principle of no persistent WebSocket, using lightweight polling instead**: unchanged.

## 6. Summary deployment checklist (Docker + Postgres version)

1. Install Docker Desktop on the client's Windows machine (enable the WSL2 backend), enable "Start when you sign in".
2. Configure autologin for the Windows account running Docker (if the client accepts the sign-in screen security trade-off).
3. Migrate the entire backend data access layer from `mysql2` to `pg`, rewrite the migration/schema in PostgreSQL syntax (section 4), rewrite the `issue_key` generation logic using a transaction + `RETURNING`.
4. Build the React frontend (`npm run build`) → the `frontend-dist/` folder.
5. Write the backend `Dockerfile` (Node LTS base image, copy the obfuscated/bytenode-compiled code).
6. Write `docker-compose.yml` (db, app, caddy, optionally cloudflared) + `Caddyfile` + `.env`.
7. Generate the device fingerprint for the license key using the approach chosen in section 5.3, and put it into `.env`.
8. `docker compose up -d`, check `docker compose ps` that all 3 (or 4) services are `Up`.
9. Configure Task Scheduler to run the `pg_dump` script via `docker exec` nightly, rotating backups.
10. Verify: reboot the actual machine, confirm Docker Desktop starts automatically, all containers come back up on their own (`restart: unless-stopped`), and the app is accessible without any manual steps.

## 7. Jira-style Workspace Expansion Deployment (approved 2026-08-22)

The Summary, Backlog, Timeline, Development, Docs, Forms, and collapsible-sidebar expansion does not add a service or change the deployment stack. It remains React static assets behind Caddy, Express on Node.js LTS, and PostgreSQL 16 in Docker Compose.

For an existing installation, run the idempotent workspace migration before starting the rebuilt backend. For a clean installation, `schema.sql` creates the full 14-table schema. Deployment order is: take a `pg_dump -Fc` backup, apply the migration, build/test backend and frontend, refresh `frontend-dist/`, rebuild the protected app image, then run API and browser smoke tests through Caddy. Rollback requires restoring the pre-migration dump together with the prior app/static artifacts.

No additional host ports, Windows services, Docker services, persistent WebSocket, or external OAuth provider are introduced by this expansion.

## 8. Board Controls and Account Provisioning Deployment (approved 2026-08-22)

This expansion requires no new service, host port, or table. Before deploying it, ensure the approved bootstrap administrator exists; public registration is disabled and account creation thereafter is performed by authenticated project administrators through the existing API/Caddy path. Deploy the rebuilt backend and static frontend together so board controls and their API contract remain in sync. The sprint-completion operation is transactional in PostgreSQL and requires the existing database backup procedure before rollout.

## 9. Space Access Isolation Deployment (approved 2026-08-22)

The Space terminology and viewer-assignment expansion reuses the `projects` and `project_members` tables, so no migration or additional container is required. Backend and frontend must be deployed together because `POST /api/projects` gains atomic `viewerIds` handling and becomes admin-only. Existing data is preserved. After deployment, verify with separate admin/viewer accounts that viewers list and open only assigned Spaces, receive `403` for unassigned Space IDs, and cannot perform mutations.

## 10. Unified Space home/sidebar deployment note (2026-08-22)

The home/sidebar expansion also requires no migration or container change. Deploy the backend RBAC/list-query update and the frontend route/sidebar update together. Verify that `/projects` redirects to `/`, login lands on `/`, an Admin sees every Space and can open `/spaces/new`, and a non-admin sees only assigned Spaces with no creation control. The same Space count/list must appear on the home screen and workspace sidebar.

## 11. Issue completion migration note (2026-08-22)

Apply `backend/src/db/migrations/003-issue-completion.sql` once to an existing PostgreSQL volume before starting the updated application. Fresh databases receive the same `completed_at` column and indexes from `schema.sql`. Backfill sets `completed_at` from the latest transition into the issue's current final status. Deploy backend and frontend together, then verify created/completed day filters, assignee-name display, member self-assignment, completed-member `403`, and Admin reopen/edit.

## 12. Dedicated account and Space-access administration (2026-08-22)

The `/teams` administration feature reuses `users`, `projects`, `project_members`, and the existing authenticated account/member APIs. It requires no database migration, container, host port, or dependency. Deploy the rebuilt React assets through Caddy. Verify that only an application Admin sees Teams, account provisioning remains authenticated, viewer access can be granted and revoked per Space, administrator memberships cannot be revoked from the UI, and individual Space settings no longer contain account or membership controls.
