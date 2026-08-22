# Windows deployment handover

1. Install Docker Desktop with the WSL2 backend and enable **Start Docker Desktop when you sign in**. Keep sleep/hibernate disabled for an always-on host.
2. Copy `.env.example` to `.env`, fill every secret, run `backend/scripts/get-host-fingerprint.ps1`, and set the resulting `HOST_FINGERPRINT`. `LICENSE_KEY` is the SHA-256 of `taskflow:<HOST_FINGERPRINT>`.
3. Set `PGDATA_PATH` to an explicit host directory (for example `D:/taskflow-data/pgdata`) and run `frontend\npm.cmd run build`, copy `frontend\dist` to `frontend-dist`, then run `docker compose up -d --build`.
4. Inspect health with `docker compose ps`; view logs with `docker compose logs -f`; restart with `docker compose restart`.
5. Run a manual backup with `pwsh -File scripts/backup-postgres.ps1`. Dumps are in `backups/`; restore with `scripts/restore-postgres-test.ps1` against a selected dump before any emergency production restore.

The default stack serves HTTP/HTTPS on ports 80/443. For a staging host with those ports occupied, set `CADDY_HTTP_PORT` and `CADDY_HTTPS_PORT` temporarily; production should use the firewall-approved LAN ports. No database port is published by Compose.
