[CmdletBinding()]
param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '.env'),
  [string]$BackupDirectory,
  [int]$RetentionDays = 0
)

$ErrorActionPreference = 'Stop'
$script:LogFile = $null
$script:PartialFile = $null
$script:LockStream = $null

function Import-LocalEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    if (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) { return }
    throw "Backup configuration was not found: $Path. Copy backup\.env.example to backup\.env and configure it, or provide process environment variables."
  }

  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }

    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { throw "Invalid .env line: $rawLine" }

    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
      throw "Invalid environment variable name: $name"
    }
    if ($value.Length -ge 2) {
      $first = $value.Substring(0, 1)
      $last = $value.Substring($value.Length - 1, 1)
      if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

function Get-VietnamTime {
  $timeZone = [TimeZoneInfo]::FindSystemTimeZoneById('SE Asia Standard Time')
  return [TimeZoneInfo]::ConvertTime([DateTimeOffset]::UtcNow, $timeZone)
}

function Write-BackupLog {
  param(
    [ValidateSet('INFO', 'SUCCESS', 'WARNING', 'ERROR')][string]$Level,
    [string]$Message
  )

  $line = '{0} [{1}] {2}' -f (Get-VietnamTime).ToString('yyyy-MM-dd HH:mm:ss zzz'), $Level, $Message
  if ($null -ne $script:LogFile) {
    Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8
  }
  Write-Output $line
}

function Resolve-PostgresTool {
  param([string]$ToolName, [string]$ConfiguredBinDirectory)

  if (-not [string]::IsNullOrWhiteSpace($ConfiguredBinDirectory)) {
    $configuredPath = Join-Path $ConfiguredBinDirectory "$ToolName.exe"
    if (Test-Path -LiteralPath $configuredPath -PathType Leaf) { return $configuredPath }
    throw "$ToolName.exe was not found in PG_BIN_DIR: $ConfiguredBinDirectory"
  }

  $command = Get-Command $ToolName -ErrorAction SilentlyContinue
  if ($null -ne $command) { return $command.Source }

  $postgresRoot = 'C:\Program Files\PostgreSQL'
  if (Test-Path -LiteralPath $postgresRoot -PathType Container) {
    $installations = Get-ChildItem -LiteralPath $postgresRoot -Directory |
      Sort-Object -Property @{ Expression = {
        try { [version]$_.Name } catch { [version]'0.0' }
      }} -Descending
    foreach ($installation in $installations) {
      $candidate = Join-Path $installation.FullName "bin\$ToolName.exe"
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
  }

  throw "$ToolName was not found. Install PostgreSQL client tools or set PG_BIN_DIR in backup\.env."
}

function Get-DatabaseSettings {
  param([string]$DatabaseUrl)

  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'DATABASE_URL is required.' }
  $uri = [Uri]$DatabaseUrl
  if ($uri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'DATABASE_URL must use the postgresql:// scheme.'
  }

  $userInfo = $uri.UserInfo -split ':', 2
  if ($userInfo.Count -ne 2) { throw 'DATABASE_URL must include both user and password.' }
  $databaseName = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($databaseName)) { throw 'DATABASE_URL must include a database name.' }

  $sslMode = 'require'
  if ($uri.Query -match '(?:^|[?&])sslmode=([^&]+)') {
    $sslMode = [Uri]::UnescapeDataString($Matches[1])
  }

  return [pscustomobject]@{
    Host = $uri.Host
    Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
    User = [Uri]::UnescapeDataString($userInfo[0])
    Password = [Uri]::UnescapeDataString($userInfo[1])
    Database = $databaseName
    SslMode = $sslMode
  }
}

function Set-DatabaseEnvironment {
  param($Settings)

  $values = @{
    PGHOST = $Settings.Host
    PGPORT = [string]$Settings.Port
    PGUSER = $Settings.User
    PGPASSWORD = $Settings.Password
    PGDATABASE = $Settings.Database
    PGSSLMODE = $Settings.SslMode
    PGCONNECT_TIMEOUT = '30'
    PGAPPNAME = 'taskflow_local_backup'
    PGOPTIONS = '-c default_transaction_read_only=on'
  }
  $previous = @{}
  foreach ($name in $values.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
  }
  return $previous
}

function Restore-Environment {
  param($Previous)
  if ($null -eq $Previous) { return }
  foreach ($name in $Previous.Keys) {
    [Environment]::SetEnvironmentVariable($name, $Previous[$name], 'Process')
  }
}

$previousDatabaseEnvironment = $null
$verifiedFinalFile = $null

try {
  Import-LocalEnv -Path $EnvFile

  if ([string]::IsNullOrWhiteSpace($BackupDirectory)) { $BackupDirectory = $env:BACKUP_DIR }
  if ([string]::IsNullOrWhiteSpace($BackupDirectory)) { $BackupDirectory = 'D:\CompanyBackups\Supabase' }
  if ($RetentionDays -le 0) {
    if ([string]::IsNullOrWhiteSpace($env:RETENTION_DAYS)) { $RetentionDays = 30 }
    else { $RetentionDays = [int]$env:RETENTION_DAYS }
  }
  if ($RetentionDays -lt 1 -or $RetentionDays -gt 3650) { throw 'RETENTION_DAYS must be between 1 and 3650.' }

  $prefix = if ([string]::IsNullOrWhiteSpace($env:BACKUP_PREFIX)) { 'company_db' } else { $env:BACKUP_PREFIX }
  if ($prefix -notmatch '^[A-Za-z0-9_-]+$') { throw 'BACKUP_PREFIX may contain only letters, numbers, underscore, and hyphen.' }
  $schema = if ([string]::IsNullOrWhiteSpace($env:PG_SCHEMA)) { 'public' } else { $env:PG_SCHEMA }
  if ($schema -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw 'PG_SCHEMA is invalid.' }

  New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
  $resolvedBackupDirectory = (Resolve-Path -LiteralPath $BackupDirectory).Path
  $logDirectory = Join-Path $resolvedBackupDirectory 'logs'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $script:LogFile = Join-Path $logDirectory 'backup.log'

  $runTime = Get-VietnamTime
  $backupName = '{0}_{1}.dump' -f $prefix, $runTime.ToString('yyyy-MM-dd_HH-mm')
  $finalFile = Join-Path $resolvedBackupDirectory $backupName
  $script:PartialFile = "$finalFile.partial"

  Write-BackupLog INFO "START backup_file=$backupName retention_days=$RetentionDays schema=$schema"

  $lockPath = Join-Path $resolvedBackupDirectory '.backup.lock'
  try {
    $script:LockStream = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  } catch {
    throw 'Another backup process is already running.'
  }

  if (Test-Path -LiteralPath $finalFile -PathType Leaf) {
    throw "A backup for this exact minute already exists: $backupName"
  }
  if (Test-Path -LiteralPath $script:PartialFile -PathType Leaf) {
    Write-BackupLog WARNING "Removing stale partial file: $([IO.Path]::GetFileName($script:PartialFile))"
    Remove-Item -LiteralPath $script:PartialFile -Force
  }

  $pgDump = Resolve-PostgresTool -ToolName 'pg_dump' -ConfiguredBinDirectory $env:PG_BIN_DIR
  $pgRestore = Resolve-PostgresTool -ToolName 'pg_restore' -ConfiguredBinDirectory $env:PG_BIN_DIR
  $databaseSettings = Get-DatabaseSettings -DatabaseUrl $env:DATABASE_URL
  $previousDatabaseEnvironment = Set-DatabaseEnvironment -Settings $databaseSettings

  $dumpArguments = @(
    '--format=custom',
    '--compress=6',
    '--no-owner',
    '--no-privileges',
    "--schema=$schema",
    "--file=$($script:PartialFile)"
  )
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $dumpOutput = & $pgDump @dumpArguments 2>&1
    $dumpExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedErrorActionPreference
  }
  foreach ($outputLine in $dumpOutput) { Write-BackupLog INFO "pg_dump: $outputLine" }
  if ($dumpExitCode -ne 0) {
    $failedSize = if (Test-Path -LiteralPath $script:PartialFile -PathType Leaf) { (Get-Item -LiteralPath $script:PartialFile).Length } else { 0 }
    Write-BackupLog ERROR "pg_dump_result=FAILURE exit_code=$dumpExitCode"
    Write-BackupLog INFO "backup_size_bytes=$failedSize"
    Write-BackupLog INFO 'verification_result=NOT_RUN'
    Write-BackupLog INFO 'retention_deleted=NOT_RUN'
    throw "pg_dump failed with exit code $dumpExitCode."
  }
  Write-BackupLog INFO 'pg_dump_result=SUCCESS'

  if (-not (Test-Path -LiteralPath $script:PartialFile -PathType Leaf)) {
    Write-BackupLog INFO 'backup_size_bytes=0'
    Write-BackupLog INFO 'verification_result=NOT_RUN'
    Write-BackupLog INFO 'retention_deleted=NOT_RUN'
    throw 'pg_dump returned success but did not create the expected file.'
  }
  $backupSize = (Get-Item -LiteralPath $script:PartialFile).Length
  Write-BackupLog INFO "backup_size_bytes=$backupSize"
  if ($backupSize -le 0) {
    Write-BackupLog INFO 'verification_result=NOT_RUN'
    Write-BackupLog INFO 'retention_deleted=NOT_RUN'
    throw 'The created backup is empty.'
  }

  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $verificationOutput = & $pgRestore --list $script:PartialFile 2>&1
    $verificationExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedErrorActionPreference
  }
  if ($verificationExitCode -ne 0 -or @($verificationOutput).Count -eq 0) {
    foreach ($outputLine in $verificationOutput) { Write-BackupLog ERROR "pg_restore_verify: $outputLine" }
    Write-BackupLog ERROR "verification_result=FAILURE exit_code=$verificationExitCode"
    Write-BackupLog INFO 'retention_deleted=NOT_RUN'
    throw "Backup verification failed with exit code $verificationExitCode."
  }
  Write-BackupLog INFO 'verification_result=SUCCESS method=pg_restore--list'

  Move-Item -LiteralPath $script:PartialFile -Destination $finalFile
  $script:PartialFile = $null
  $verifiedFinalFile = $finalFile
  $hash = (Get-FileHash -LiteralPath $finalFile -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath "$finalFile.sha256" -Value "$hash  $backupName" -Encoding ASCII
  Write-BackupLog INFO "sha256=$hash"

  $cutoffUtc = [DateTime]::UtcNow.AddDays(-$RetentionDays)
  $expiredBackups = Get-ChildItem -LiteralPath $resolvedBackupDirectory -Filter "$prefix`_*.dump" -File |
    Where-Object { $_.LastWriteTimeUtc -lt $cutoffUtc } |
    Sort-Object LastWriteTimeUtc

  if (@($expiredBackups).Count -eq 0) {
    Write-BackupLog INFO 'retention_deleted=NONE'
  } else {
    foreach ($expiredBackup in $expiredBackups) {
      Remove-Item -LiteralPath $expiredBackup.FullName -Force
      $expiredChecksum = "$($expiredBackup.FullName).sha256"
      if (Test-Path -LiteralPath $expiredChecksum -PathType Leaf) {
        Remove-Item -LiteralPath $expiredChecksum -Force
      }
      Write-BackupLog INFO "retention_deleted=$($expiredBackup.Name)"
    }
  }

  Write-BackupLog SUCCESS "FINAL status=SUCCESS backup_file=$backupName size_bytes=$backupSize verification=SUCCESS"
  Write-Output $finalFile
} catch {
  if ($null -ne $script:LogFile) {
    Write-BackupLog ERROR "FINAL status=FAILURE reason=$($_.Exception.Message)"
  }
  if ($null -ne $script:PartialFile -and (Test-Path -LiteralPath $script:PartialFile -PathType Leaf)) {
    Remove-Item -LiteralPath $script:PartialFile -Force -ErrorAction SilentlyContinue
  }
  throw
} finally {
  Restore-Environment -Previous $previousDatabaseEnvironment
  if ($null -ne $script:LockStream) { $script:LockStream.Dispose() }
}
