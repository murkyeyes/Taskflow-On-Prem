# Windows Task Scheduler: Supabase backups

The current production procedure is the self-contained [`backup/`](../backup/README.md)
package. It supersedes the older Docker/DPAPI daily and weekly scripts under
`scripts/`.

Taskflow creates a verified PostgreSQL custom-format logical backup at 00:00,
06:00, 12:00, and 18:00 Vietnam time. The task connects directly to Supabase and
does not depend on Render or the application backend.

## Quick setup

1. Install PostgreSQL command-line tools on the trusted Windows backup machine.
2. Copy `backup/.env.example` to the Git-ignored `backup/.env` and add the Supabase
   Session pooler URI.
3. Prove one manual backup:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\backup\backup-supabase.ps1
   ```

4. From PowerShell opened with **Run as administrator**, register the restart-safe
   SYSTEM task:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\backup\setup-scheduled-task.ps1 -RunNow
   ```

5. Confirm `LastTaskResult` is `0`, a new `.dump` and `.sha256` exist, and
   `D:\CompanyBackups\Supabase\logs\backup.log` ends with
   `FINAL status=SUCCESS`.

All prerequisites, security notes, configuration options, retention behavior,
verification commands, and the deliberately guarded restore workflow are documented
in [`backup/README.md`](../backup/README.md).
