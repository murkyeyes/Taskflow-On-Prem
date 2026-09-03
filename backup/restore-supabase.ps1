[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$DumpFile,
  [Parameter(Mandatory)][string]$TargetEnvFile,
  [switch]$ConfirmRestore
)

$ErrorActionPreference = 'Stop'

function Import-TargetEnv {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Target configuration was not found: $Path"
  }
  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { throw "Invalid .env line: $rawLine" }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw "Invalid environment variable name: $name" }
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
      Sort-Object -Property @{ Expression = { try { [version]$_.Name } catch { [version]'0.0' } }} -Descending
    foreach ($installation in $installations) {
      $candidate = Join-Path $installation.FullName "bin\$ToolName.exe"
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
  }
  throw "$ToolName was not found. Install PostgreSQL client tools or set PG_BIN_DIR."
}

function Get-DatabaseSettings {
  param([string]$DatabaseUrl)
  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'TARGET_DATABASE_URL is required.' }
  $uri = [Uri]$DatabaseUrl
  if ($uri.Scheme -notin @('postgres', 'postgresql')) { throw 'TARGET_DATABASE_URL must use postgresql://.' }
  $userInfo = $uri.UserInfo -split ':', 2
  if ($userInfo.Count -ne 2) { throw 'TARGET_DATABASE_URL must include both user and password.' }
  $databaseName = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($databaseName)) { throw 'TARGET_DATABASE_URL must include a database name.' }
  $sslMode = 'require'
  if ($uri.Query -match '(?:^|[?&])sslmode=([^&]+)') { $sslMode = [Uri]::UnescapeDataString($Matches[1]) }
  [pscustomobject]@{
    Host = $uri.Host; Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
    User = [Uri]::UnescapeDataString($userInfo[0]); Password = [Uri]::UnescapeDataString($userInfo[1])
    Database = $databaseName; SslMode = $sslMode
  }
}

function Set-DatabaseEnvironment {
  param($Settings)
  $values = @{
    PGHOST=$Settings.Host; PGPORT=[string]$Settings.Port; PGUSER=$Settings.User
    PGPASSWORD=$Settings.Password; PGDATABASE=$Settings.Database; PGSSLMODE=$Settings.SslMode
    PGCONNECT_TIMEOUT='30'; PGAPPNAME='taskflow_restore'
  }
  $previous = @{}
  foreach ($name in $values.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
  }
  $previous
}

function Restore-Environment {
  param($Previous)
  if ($null -eq $Previous) { return }
  foreach ($name in $Previous.Keys) { [Environment]::SetEnvironmentVariable($name, $Previous[$name], 'Process') }
}

if (-not $ConfirmRestore) {
  throw 'Restore is disabled by default. Review the explicit target and rerun with -ConfirmRestore.'
}
if (-not (Test-Path -LiteralPath $DumpFile -PathType Leaf)) { throw "Dump file was not found: $DumpFile" }
$resolvedDump = (Resolve-Path -LiteralPath $DumpFile).Path
if ((Get-Item -LiteralPath $resolvedDump).Length -le 0) { throw 'The selected dump file is empty.' }

Import-TargetEnv -Path $TargetEnvFile
$pgRestore = Resolve-PostgresTool -ToolName 'pg_restore' -ConfiguredBinDirectory $env:PG_BIN_DIR
$psql = Resolve-PostgresTool -ToolName 'psql' -ConfiguredBinDirectory $env:PG_BIN_DIR

$savedErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $listOutput = & $pgRestore --list $resolvedDump 2>&1
  $listExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $savedErrorActionPreference
}
if ($listExitCode -ne 0 -or @($listOutput).Count -eq 0) { throw 'pg_restore could not read the selected dump.' }
$checksumFile = "$resolvedDump.sha256"
if (Test-Path -LiteralPath $checksumFile -PathType Leaf) {
  $expectedHash = ((Get-Content -LiteralPath $checksumFile -First 1) -split '\s+')[0].ToLowerInvariant()
  $actualHash = (Get-FileHash -LiteralPath $resolvedDump -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expectedHash -ne $actualHash) { throw 'The dump SHA-256 checksum does not match.' }
}

$settings = Get-DatabaseSettings -DatabaseUrl $env:TARGET_DATABASE_URL
$previousDatabaseEnvironment = $null
$listFile = $null
try {
  $previousDatabaseEnvironment = Set-DatabaseEnvironment -Settings $settings
  $objectCountSql = "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')) + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public');"
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $objectCountOutput = & $psql --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command $objectCountSql 2>&1
    $objectCountExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedErrorActionPreference
  }
  if ($objectCountExitCode -ne 0) { throw "Target preflight query failed: $objectCountOutput" }
  $objectCount = 0
  if (-not [int]::TryParse(([string]$objectCountOutput).Trim(), [ref]$objectCount)) { throw 'Could not determine whether the target database is empty.' }
  if ($objectCount -gt 0) {
    throw "Target public schema contains $objectCount application objects. Restore only into an empty target database; this script will not clean or overwrite it."
  }

  $listFile = Join-Path ([IO.Path]::GetTempPath()) ("taskflow-restore-{0}.list" -f [guid]::NewGuid().ToString('N'))
  $filteredList = foreach ($rawLine in $listOutput) {
    $line = [string]$rawLine
    if ($line -match ';.*(?:SCHEMA|COMMENT).*public(?:\s|$)') { ";$line" } else { $line }
  }
  [IO.File]::WriteAllLines($listFile, [string[]]$filteredList, [Text.UTF8Encoding]::new($false))

  Write-Output "Restoring $resolvedDump into explicitly configured target $($settings.Host):$($settings.Port)/$($settings.Database)"
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $restoreOutput = & $pgRestore --exit-on-error --single-transaction --no-owner --no-privileges "--use-list=$listFile" "--dbname=$($settings.Database)" $resolvedDump 2>&1
    $restoreExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedErrorActionPreference
  }
  foreach ($line in $restoreOutput) { Write-Output $line }
  if ($restoreExitCode -ne 0) { throw "pg_restore failed with exit code $restoreExitCode." }
  Write-Output 'Restore completed successfully.'
} finally {
  Restore-Environment -Previous $previousDatabaseEnvironment
  if ($null -ne $listFile -and (Test-Path -LiteralPath $listFile)) { Remove-Item -LiteralPath $listFile -Force }
}
