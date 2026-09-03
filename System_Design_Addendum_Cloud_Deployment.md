# System Design Addendum — Cloud Deployment

**Approved:** 2026-08-26  
**Production target:** Render backend, Vercel frontend, Supabase PostgreSQL, Cloudflare reverse proxy/DNS/TLS  
**Supersedes:** Windows/Docker/Caddy as the production deployment target

## 1. Architecture

Use one customer-owned apex domain and two product hostnames:

| Hostname | Cloudflare origin | Responsibility |
|---|---|---|
| `app.example.com` | Vercel project | React/Vite UI |
| `api.example.com` | Render Web Service | Express `/api/*` |

Cloudflare proxies both records after Vercel and Render have verified the domains and
issued their origin certificates. Browser API traffic is cross-origin but same-site;
the backend therefore allows only `https://app.example.com` with credentials and
keeps the JWT in a Secure, HttpOnly, SameSite=Lax cookie.

## 2. Provider responsibilities

### Vercel

- Project root is `frontend`.
- Build command is `npm run build`; output is `dist`.
- `VITE_API_BASE_URL=https://api.example.com/api` is a production environment value.
- `vercel.json` rewrites client-side routes to `index.html`.

### Render

- `render.yaml` defines one Docker Web Service built from `backend/Dockerfile`.
- Express listens on `0.0.0.0:$PORT`.
- `/api/health` is the readiness endpoint and checks PostgreSQL.
- Runtime secrets are entered in Render, not committed or used as Docker build args.

### Supabase

- Existing PostgreSQL DDL and migrations remain authoritative.
- Render uses the Supavisor Session pooler (`5432`) when an IPv4 connection is
  required. Direct connection (`5432`) is preferred for migrations and `pg_dump`
  from an IPv6-capable trusted runner.
- All connections require TLS. The frontend never receives a database password,
  anon key, or service-role key because it talks only to Express.
- Exposed Supabase Data API access is not used by Taskflow. If `public` remains
  exposed, migration 010 enables RLS on every Taskflow table without browser-facing
  policies. Do not expose a service-role key or database credential to Vercel.

### Cloudflare

- DNS records start as DNS-only for provider verification/certificate issuance,
  then become Proxied.
- SSL/TLS mode is Full (strict) once both origins have valid certificates.
- Do not cache `/api/*`; optionally add rate limits/WAF rules for authentication.

## 3. Deployment identifiers and licensing

Render containers are replaceable and do not have a stable machine identifier.
Generate a random deployment identifier once, store it as `HOST_FINGERPRINT` in
Render, derive the existing `LICENSE_KEY`, and keep both stable across redeploys.
Container IDs and host hardware identifiers are not part of the cloud license.

## 4. Database delivery

For a fresh project, apply `backend/src/db/schema.sql`, then create the first Overall
Admin with `npm run bootstrap-admin`. Never run the development-only `seed.sql` in
production. For an existing installation, apply every unapplied numbered migration
in order. Before production migrations, create a `pg_dump -Fc` logical backup and
confirm that the selected Supabase plan's backup/PITR policy satisfies the recovery
objective.

In addition to provider backups, the `backup/` operations package runs on a trusted
Windows machine at 00:00, 06:00, 12:00, and 18:00 Vietnam time
(`Asia/Ho_Chi_Minh`; Windows `SE Asia Standard Time`). It connects directly to
PostgreSQL through the Supavisor Session pooler when IPv4 is required and uses native
PostgreSQL client tools; the Taskflow backend does not need to be running. The
database URI is supplied through a local Git-ignored `backup/.env` or process
environment and is never included in source or Scheduled Task arguments.

Each run writes `company_db_YYYY-MM-DD_HH-mm.dump` in PostgreSQL custom format to a
configurable local folder, validates it with `pg_restore --list`, creates a SHA-256
sidecar, and logs the complete result to `logs/backup.log`. A `.partial` file is never
promoted when dump or verification fails. Only verified backups older than 30 days
are removed, and every deletion is logged. Windows Task Scheduler uses four daily
triggers plus StartWhenAvailable/retry settings so reboots and temporary downtime do
not permanently disable the schedule.
The destination must be a second disk or restricted cloud-synced directory; Render's
ephemeral filesystem is never a backup destination. A quarterly restore into a clean
non-production PostgreSQL instance proves recoverability. Four-times-daily scheduling
permits up to almost six hours of data loss, so a more frequent schedule or Supabase
PITR is required when the business recovery-point objective is stricter. Restore
requires an explicitly supplied target connection and confirmation flag and never
automatically cleans or overwrites production.

The application keeps using `pg` and its repository/service transaction boundaries.
It does not migrate to Supabase Auth or the browser Supabase SDK in this phase.

## 5. Release and rollback

Initial release order:

1. Create Supabase project and apply schema/migrations.
2. Deploy Render and verify `/api/health` on the Render hostname.
3. Deploy Vercel with the temporary Render API URL and verify login/navigation.
4. Add custom domains in Vercel and Render.
5. Add Cloudflare DNS records as DNS-only; wait for verification and certificates.
6. Set Vercel API URL and Render CORS allowlist to the final hostnames.
7. Enable Cloudflare proxy and Full (strict), then smoke-test end to end.

Application rollback uses provider deployment rollback. Database rollback requires a
tested reverse migration or restoring the pre-release backup; rolling back only the
frontend or backend is forbidden when its API/schema contract changed.

## 6. Operations

- Monitor Render health/deploy logs, Vercel build/runtime logs, Supabase database
  health/backups, and Cloudflare security analytics.
- Monitor the Windows Scheduled Task exit status and `logs/backup.log`; investigate
  every missed or failed daily run before the next scheduled run.
- Rotate `JWT_SECRET`, database credentials, and provider tokens through provider
  secret stores. A JWT rotation signs out existing sessions.
- Keep provider accounts protected by MFA and use least-privilege team access.
- Local Docker Compose/Caddy files remain for offline development and legacy recovery,
  not as the production source of truth.

## 7. Official references

- [Render Web Services](https://render.com/docs/web-services)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render with Cloudflare DNS](https://render.com/docs/configure-cloudflare-dns)
- [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel Vite deployments](https://vercel.com/docs/frameworks/frontend/vite)
- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Cloudflare Full (strict) TLS](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
