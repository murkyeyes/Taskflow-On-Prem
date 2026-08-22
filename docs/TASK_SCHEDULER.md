# Nightly PostgreSQL backup

Run PowerShell as the account that owns Docker Desktop and schedule:

```powershell
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File D:\deploy_web\Taskflow-On-Prem\scripts\backup-postgres.ps1
```

Create a daily Task Scheduler trigger after Docker Desktop is available at sign-in. Keep the task running only after the Docker Compose `db` service is healthy. The script retains the newest 14 `.dump` files and fails loudly if `pg_dump` or `docker cp` fails.
