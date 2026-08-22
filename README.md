# Taskflow On-Prem

Taskflow On-Prem is a self-hosted task and issue tracker. The prescribed stack is a Node.js LTS/Express backend using PostgreSQL 16 through `pg`, a React frontend, and Caddy as the static server and HTTPS reverse proxy. Production deployment uses Docker Compose on Windows with the WSL2 backend.

This repository is being built phase-by-phase according to `CHECKLIST.md`. Commands below describe the intended development and deployment workflow; components become runnable as their checklist phases are completed.

## Local development

Prerequisites:

- Node.js LTS 20.x or 22.x and npm
- PostgreSQL 16
- A local environment file created from `.env.example`

Backend:

```powershell
Copy-Item .env.example .env
Set-Location backend
npm install
npm run dev
```

Frontend, in a second terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

The backend uses PostgreSQL parameterized queries and cookie-based JWT authentication. Do not put the JWT in browser storage. Local database initialization commands will be documented when the database scripts are added in Phase 1.

## Build flow

Build the React source project from `frontend/`:

```powershell
Set-Location frontend
npm install
npm run build
```

The standard frontend build output is `frontend/dist/`. During production packaging, that output is copied or synchronized to the root `frontend-dist/` deployment artifact served by Caddy. The backend production build will compile sensitive modules with `bytenode` and obfuscate the remaining production code before the Docker image is assembled; development source remains unchanged.

## Docker deployment on Windows

Prerequisites:

- Docker Desktop configured with the WSL2 backend
- Docker Desktop set to start when the deployment user signs in
- Sleep and hibernation disabled on the always-on host
- A deployment environment file created from `.env.example`, with real secrets and the host-generated `HOST_FINGERPRINT`

Start the stack from the repository root:

```powershell
Copy-Item .env.example .env
# Fill in every required value in .env before continuing.
docker compose up -d --build
docker compose ps
```

The production stack consists of separate `db`, `app`, and `caddy` containers on the internal `app-net` network. PostgreSQL must not publish port 5432 to the host. Caddy serves the React static build and proxies `/api/*` to the app container.

View logs or stop the stack:

```powershell
docker compose logs -f
docker compose down
```

Do not commit `.env`. Database backups belong in `backups/` and use PostgreSQL custom dump format (`pg_dump -Fc`).

See [docs/DEPLOYMENT_HANDOVER.md](docs/DEPLOYMENT_HANDOVER.md) for Windows handover, fingerprint/license setup, scheduled backups, and restore steps. Remote access through Cloudflare Tunnel is optional and is not enabled unless the deployment owner requests it.
