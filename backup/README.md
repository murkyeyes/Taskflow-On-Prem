# Supabase PostgreSQL backups on Windows

This package backs up Taskflow's Supabase PostgreSQL `public` schema directly to a
Windows machine. It does not depend on Render or the Taskflow backend being online.
The scheduled job runs every day at **00:00, 06:00, 12:00, and 18:00 Vietnam time**.

```text
Supabase PostgreSQL
        |
        | pg_dump -Fc (read-only session)
        v
D:\CompanyBackups\Supabase\
        |-- company_db_YYYY-MM-DD_HH-mm.dump
        |-- company_db_YYYY-MM-DD_HH-mm.dump.sha256
        `-- logs\backup.log
```

## Prerequisites

- A trusted Windows computer that can reach Supabase and is available around the
  scheduled times. Task Scheduler catches up after a reboot or missed trigger.
- Windows time zone **(UTC+07:00) Bangkok, Hanoi, Jakarta**, whose ID is
  `SE Asia Standard Time`.
- PostgreSQL command-line tools (`pg_dump`, `pg_restore`, and `psql`) at the same or
  a newer major version than the Supabase database. Install the Windows PostgreSQL
  package from <https://www.postgresql.org/download/windows/> and include Command
  Line Tools. No local PostgreSQL server is required.
- A local or protected network/synced backup folder with enough free space.

Supabase Free projects should regularly export and retain their own backups. A
second encrypted/off-site copy is strongly recommended because a backup stored only
on the same Windows disk does not protect against theft, ransomware, or disk loss.

## 1. Configure the database connection

In Supabase Dashboard, open **Connect**, choose the **Session pooler**, and copy the
PostgreSQL URI. Session pooler is appropriate for a persistent Windows/Render IPv4
client. Keep `sslmode=require`. Replace the password placeholder and percent-encode
special password characters in the URI.

Copy the example locally:

```powershell
Copy-Item .\backup\.env.example .\backup\.env
notepad .\backup\.env
```

Required and optional settings:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:PERCENT_ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
BACKUP_DIR=D:\CompanyBackups\Supabase
RETENTION_DAYS=30
BACKUP_PREFIX=company_db
PG_SCHEMA=public
PG_BIN_DIR=C:\Program Files\PostgreSQL\18\bin
```

`backup/.env` is excluded by Git. Restrict its Windows file permissions to the
administrator and SYSTEM accounts. The script passes credentials through PostgreSQL
environment variables, never command-line arguments. It also sets
`default_transaction_read_only=on`; `pg_dump` does not modify application data.

The package exports Taskflow application objects from `public`. It is not a complete
backup of Supabase-managed Auth, Storage objects, or every internal Supabase schema.

## 2. Run and verify a backup manually

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backup\backup-supabase.ps1
```

Success creates a timestamped `.dump`, a SHA-256 sidecar, and
`D:\CompanyBackups\Supabase\logs\backup.log`. The script exits non-zero and removes
the `.partial` archive when `pg_dump` fails, the archive is empty, or
`pg_restore --list` cannot read it. Existing dumps are not removed on a failed run.

Manual verification:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' --list `
  'D:\CompanyBackups\Supabase\company_db_2026-08-27_18-00.dump'
```

Files strictly older than `RETENTION_DAYS` are deleted only after the new archive
passes verification. Every deletion is written to `logs\backup.log`; files newer
than 30 days are retained with the default configuration.

## 3. Enable the four daily scheduled runs

Open **PowerShell as Administrator**, change to the repository directory, and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backup\setup-scheduled-task.ps1
```

This registers **Taskflow Supabase Backup** under the SYSTEM account with four daily
triggers, `StartWhenAvailable`, three retry attempts, and no interactive-logon
dependency. It therefore continues after Windows restarts. The repository, `.env`,
PostgreSQL tools, and destination must remain accessible to SYSTEM.

To register and immediately request a test run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backup\setup-scheduled-task.ps1 -RunNow
```

Then inspect:

```powershell
Get-ScheduledTask -TaskName 'Taskflow Supabase Backup' | Get-ScheduledTaskInfo
Get-Content 'D:\CompanyBackups\Supabase\logs\backup.log' -Tail 30
```

Expected `LastTaskResult` is `0`. Also confirm a new non-empty dump and checksum
exist and the log ends with `FINAL status=SUCCESS`.

## Restore safely

The restore script requires a **separate explicit target** and refuses a target whose
`public` schema already contains application objects. It never uses `--clean`, never
selects production automatically, and does not create/drop a database.

Create a Git-ignored `backup/restore-target.env` for a clean test/recovery database:

```dotenv
TARGET_DATABASE_URL=postgresql://USER:PERCENT_ENCODED_PASSWORD@TARGET_HOST:5432/TARGET_DATABASE?sslmode=require
PG_BIN_DIR=C:\Program Files\PostgreSQL\18\bin
```

Review the target carefully, then explicitly confirm:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backup\restore-supabase.ps1 `
  -DumpFile 'D:\CompanyBackups\Supabase\company_db_2026-08-27_18-00.dump' `
  -TargetEnvFile .\backup\restore-target.env `
  -ConfirmRestore
```

When present, the SHA-256 sidecar is checked first. The script validates the archive,
checks that the target `public` schema is empty, and uses one transaction with
`--exit-on-error`. Restore into a clean recovery database, validate Taskflow there,
and only then perform a separately reviewed production cutover.

## Change settings

- **Backup directory:** edit `BACKUP_DIR` in `backup/.env`, or pass
  `-BackupDirectory 'E:\Protected\Taskflow'` for a one-off run.
- **Retention:** edit `RETENTION_DAYS`, or pass `-RetentionDays 60`.
- **Schedule:** pass, for example, `-BackupTimes '01:00','07:00','13:00','19:00'`
  to `setup-scheduled-task.ps1`, then rerun it as Administrator. Leave the Windows
  time zone check intact.
- **Connection:** update only the local `.env`, then run a manual backup and restore
  drill before relying on the changed configuration.

With four successful runs, the backup recovery-point objective is almost six hours.
Review the log and Scheduled Task result daily, and perform a restore drill at least
quarterly.

Official references:

- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- <https://supabase.com/docs/guides/database/connecting-to-postgres>
