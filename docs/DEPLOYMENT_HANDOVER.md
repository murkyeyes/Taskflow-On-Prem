# Cloud deployment and handover

This runbook deploys Taskflow with Render (API), Vercel (UI), Supabase (PostgreSQL),
and Cloudflare (authoritative DNS and reverse proxy).

## 1. Values to choose first

Replace the examples below with one domain you control:

| Purpose | Example |
|---|---|
| Frontend | `app.example.com` |
| Backend API | `api.example.com` |
| Render region | Singapore (choose close to Supabase users/database) |
| Supabase region | Same or nearest practical region to Render |

Keep the two application hostnames under the same apex domain. The temporary
`*.vercel.app` and `*.onrender.com` URLs are useful during setup, but should not be
the final browser/API pair because cookie rules become cross-site.

## 2. Prepare production secrets

Generate values locally; do not paste them into source files:

```powershell
# JWT secret (copy the printed value into Render only)
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()

# Stable cloud deployment identifier
[guid]::NewGuid().ToString('N')
```

Generate the license from the chosen deployment identifier:

```powershell
$fingerprint = '<HOST_FINGERPRINT value>'
$bytes = [Text.Encoding]::UTF8.GetBytes("taskflow:$fingerprint")
[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLower()
```

Store the identifier as `HOST_FINGERPRINT` and the hash as `LICENSE_KEY` in Render.

## 3. Create Supabase PostgreSQL

1. Create a Supabase project and save the generated database password in a password
   manager.
2. In **Project Settings → Database → Connect**, copy the **Session pooler** URI.
   It uses port `5432` and a username shaped like `postgres.<project-ref>`.
3. Add `?sslmode=require` (or `&sslmode=require` when the URI already has query
   parameters). Store this URI as Render's `DATABASE_URL`.
4. Enable **Enforce SSL on incoming connections** after confirming all tools use TLS.
5. For certificate and hostname verification, download the Supabase CA certificate
   and move administrative tools to `sslmode=verify-full`.
6. Apply the schema from a trusted machine. Use the direct connection URI when that
   machine has IPv6 (or the Supabase IPv4 add-on); otherwise use Session pooler mode.

Example using `psql`:

```powershell
$env:PGCONNECT_TIMEOUT = '15'
psql '<ADMIN_DATABASE_URL>' -v ON_ERROR_STOP=1 -f backend/src/db/schema.sql
```

For an existing database, run only unapplied files from
`backend/src/db/migrations/` in numeric order. Take a backup first.

For Supabase Free, configure the independent daily 12:00 Vietnam-time verified backup before go-live:
follow `docs/TASK_SCHEDULER.md`, store the dump on a second disk or restricted
cloud-synced folder, and complete the first restore test. Render's filesystem is not
a backup destination.

For a fresh database, create the protected Overall Admin once. Do **not** run
`seed.sql`; it contains development-only credentials.

```powershell
Set-Location backend
$env:DATABASE_URL = '<ADMIN_DATABASE_URL_WITH_SSL>'
$env:BOOTSTRAP_ADMIN_NAME = 'Taskflow Owner'
$env:BOOTSTRAP_ADMIN_EMAIL = 'owner@example.com'
$secret = Read-Host 'Initial password (12-72 characters)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
$env:BOOTSTRAP_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
npm run bootstrap-admin
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
```

Remove the remaining temporary database/admin variables after the command. The
script refuses to create a second Overall Admin.

## 4. Deploy the Render backend

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Render, choose **New → Blueprint**, connect the repository, and select root
   `render.yaml`.
   The committed Blueprint uses the paid `starter` plan to avoid free-instance
   sleep; change it to `free` only for evaluation and accept cold starts/plan limits.
3. Enter the secret values requested by the Blueprint:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Supabase Session pooler URI with TLS |
| `JWT_SECRET` | Random 32-byte-or-longer secret |
| `CORS_ALLOWED_ORIGINS` | Initially Vercel preview; finally `https://app.example.com` |
| `HOST_FINGERPRINT` | Stable generated deployment identifier |
| `LICENSE_KEY` | SHA-256 license derived above |

4. Deploy and wait for `https://<service>.onrender.com/api/health` to return:

```json
{"status":"ok","database":"ok"}
```

If it returns `503`, check the Supabase password, pooler username/host, TLS query
parameter, project pause state, and Render/Supabase regions.

## 5. Deploy the Vercel frontend

1. Import the same repository into Vercel.
2. Set **Root Directory** to `frontend` and Framework Preset to Vite.
3. Set production `VITE_API_BASE_URL` to
   `https://<service>.onrender.com/api` for the first temporary test.
4. Deploy and open deep links such as `/login`, `/settings/general`, and a Space
   route directly. `frontend/vercel.json` prevents SPA deep links from returning 404.
5. The temporary cross-site pair can be affected by browser cookie restrictions; the
   custom same-site domains below are the supported production configuration.

## 6. Add custom domains through Cloudflare

### Frontend

1. Add `app.example.com` to the Vercel project.
2. Use Vercel domain inspection to obtain the exact required CNAME target.
3. Add that CNAME in Cloudflare as **DNS only**.
4. Wait until Vercel reports the domain and certificate valid.

### Backend

1. Add `api.example.com` to the Render service.
2. Remove any conflicting `AAAA` record for that hostname.
3. Add a CNAME to the Render `*.onrender.com` hostname as **DNS only**.
4. Wait until Render reports the custom domain and certificate valid.

### Enable the proxy

1. Change both CNAME records to **Proxied** (orange cloud).
2. In Cloudflare **SSL/TLS**, select **Full (strict)**.
3. Create a cache rule that bypasses cache for `api.example.com/*`.
4. Optionally rate-limit login/password endpoints; never blanket-cache authenticated
   API responses.

## 7. Switch to final URLs

1. Vercel: `VITE_API_BASE_URL=https://api.example.com/api`.
2. Render: `CORS_ALLOWED_ORIGINS=https://app.example.com`.
3. Keep `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=true`.
4. Leave `COOKIE_DOMAIN` unset. A host-only API cookie has the smallest scope.
5. Redeploy both services.

Multiple UI origins are comma-separated in `CORS_ALLOWED_ORIGINS`; never use `*`
with credentialed cookies.

## 8. Production smoke test

```powershell
curl.exe -i https://api.example.com/api/health
curl.exe -i -X OPTIONS https://api.example.com/api/auth/login `
  -H "Origin: https://app.example.com" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"
```

Then verify in a private browser window:

1. Login sets a Secure, HttpOnly token cookie on `api.example.com`.
2. Refreshing a deep frontend route remains logged in.
3. Admin/member/viewer Space visibility and completed-task locks still work.
4. Task create/edit, report links, monthly backlog, search, and logout work.
5. An unapproved `Origin` receives `403 CORS_ORIGIN_DENIED`.
6. Cloudflare reports dynamic/BYPASS for `/api/*`, not a cached user response.

## 9. Rollback and ownership handover

- Record the Supabase project ref/region, Render service ID, Vercel project/team,
  Cloudflare zone, Git repository/branch, and secret owners in the customer's password
  manager/runbook. Do not put secret values in this document.
- Roll back frontend/backend using last known-good Vercel and Render deployments.
- If a release included a migration, use its tested reverse migration or restore the
  pre-release dump; do not run old code against an incompatible schema.
- Enable MFA for all provider accounts and use least-privilege team roles.

Official references: [Render Web Services](https://render.com/docs/web-services),
[Render and Cloudflare DNS](https://render.com/docs/configure-cloudflare-dns),
[Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain),
[Vercel Vite SPA routing](https://vercel.com/docs/frameworks/frontend/vite),
[Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres),
and [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
