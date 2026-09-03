# Taskflow

Taskflow is a Jira-style task and report tracker. The production architecture is:

```text
Browser
  ├─ app.example.com → Cloudflare → Vercel (React/Vite)
  └─ api.example.com → Cloudflare → Render (Node.js/Express)
                                          └─ Supabase PostgreSQL
```

The Express API remains the only database client and enforces all RBAC. Supabase is
used as managed PostgreSQL, not as a browser SDK or replacement authentication layer.

## Local development

Prerequisites: Node.js 20/22, npm, and PostgreSQL 16.

```powershell
Copy-Item .env.example .env
# Fill DATABASE_URL and JWT_SECRET in .env.

Set-Location backend
npm install
npm run dev
```

In a second terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Vite proxies local `/api` requests to `http://localhost:3000`. To test a remote API,
copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_BASE_URL`.

To run the complete legacy local stack through Docker and Caddy, set the required
local-only values in the ignored root `.env`, refresh `frontend-dist`, and run:

```powershell
docker compose up -d --build
```

Open `http://localhost:8080`. This Compose profile deliberately uses
`NODE_ENV=development` because its PostgreSQL connection stays inside Docker without
TLS; the Render/Supabase production profile continues to require database TLS.

## Test and build

```powershell
Set-Location backend
npm test

Set-Location ..\frontend
npm test
npm run build
```

## Production deployment

1. Create a Supabase project, copy the Session pooler connection string, append
   `sslmode=require`, apply `backend/src/db/schema.sql` for a fresh database, and run
   the one-time `npm run bootstrap-admin` command. Never use `seed.sql` in production.
2. Connect the repository to Render as a Blueprint using root `render.yaml`. Enter
   every variable marked `sync: false` in the Render Dashboard.
3. Connect the repository to Vercel with Root Directory `frontend`; set
   `VITE_API_BASE_URL` to the API URL.
4. Add `app.example.com` to Vercel and `api.example.com` to Render.
5. In Cloudflare, create provider-required CNAME records as DNS-only. Wait for both
   providers to verify and issue TLS certificates, then enable Proxied mode and Full
   (strict) TLS.
6. Set `CORS_ALLOWED_ORIGINS=https://app.example.com`, redeploy Render, and run the
   smoke tests in [docs/DEPLOYMENT_HANDOVER.md](docs/DEPLOYMENT_HANDOVER.md).

Use a common apex domain for `app` and `api`; this keeps the Secure, HttpOnly,
SameSite=Lax authentication cookie same-site. Never commit `.env`, database passwords,
JWT secrets, or provider tokens.

Detailed architecture and operations:

- [Cloud System Design](System_Design_Addendum_Cloud_Deployment.md)
- [Deployment and Handover](docs/DEPLOYMENT_HANDOVER.md)
- [Backup and Recovery](docs/TASK_SCHEDULER.md)

Legacy `docker-compose.yml` and `Caddyfile` are retained for offline development and
recovery only. The Supabase four-times-daily backup scripts run from a trusted Windows machine;
they are an operations safeguard, not a production application host.
