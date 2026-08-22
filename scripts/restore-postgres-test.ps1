[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$DumpPath,
  [string]$Container = 'taskflow-restore-test',
  [string]$Password = 'restore_test_password'
)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $DumpPath).Path
& docker rm -f $Container 2>$null | Out-Null
& docker run -d --name $Container -e "POSTGRES_PASSWORD=$Password" -e POSTGRES_USER=restore -e POSTGRES_DB=restore postgres:16-alpine | Out-Null
try {
  for ($i=0; $i -lt 30; $i++) { & docker exec $Container pg_isready -U restore -d restore *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep -Seconds 2 }
  if ($LASTEXITCODE -ne 0) { throw 'Restore PostgreSQL did not become ready.' }
  & docker cp $resolved "${Container}:/tmp/restore.dump"
  & docker exec $Container pg_restore -U restore -d restore --clean --if-exists --no-owner --no-acl /tmp/restore.dump
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }
  $count = (& docker exec $Container psql -U restore -d restore -Atc "SELECT count(*) FROM users;").Trim()
  Write-Output "Restore verified; users row count: $count"
} finally { & docker rm -f $Container | Out-Null }
