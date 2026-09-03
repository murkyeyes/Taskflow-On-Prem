[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Taskflow\backup-database-url.xml'),
  [Alias('KeepWeeks')][ValidateRange(2, 365)][int]$KeepBackups = 84,
  [string]$PostgresImage = 'postgres:17-alpine',
  [ValidatePattern('^[a-zA-Z_][a-zA-Z0-9_]*$')][string]$Schema = 'public'
)

$ErrorActionPreference = 'Stop'

function Write-BackupLog {
  param([string]$Message, [ValidateSet('INFO', 'ERROR')][string]$Level = 'INFO')
  $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK'), $Level, $Message
  Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8
  Write-Output $line
}

function ConvertFrom-BackupCredential {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Backup credential not found: $Path. Run scripts\set-backup-credential.ps1 first."
  }

  $secureValue = Import-Clixml -LiteralPath $Path
  if ($secureValue -isnot [Security.SecureString]) {
    throw 'The backup credential file does not contain a protected SecureString.'
  }

  $pointer = [IntPtr]::Zero
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
  }
}

function Get-DatabaseSettings {
  param([string]$DatabaseUrl)

  $uri = [Uri]$DatabaseUrl
  if ($uri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'Backup credential must contain a postgresql:// database URI.'
  }

  $userInfoParts = $uri.UserInfo -split ':', 2
  if ($userInfoParts.Count -ne 2) {
    throw 'Database URI must include both user and password.'
  }

  $databaseName = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($databaseName)) {
    throw 'Database URI must include the database name.'
  }

  $sslMode = 'require'
  if ($uri.Query -match '(?:^|[?&])sslmode=([^&]+)') {
    $sslMode = [Uri]::UnescapeDataString($Matches[1])
  }

  [pscustomobject]@{
    Host = $uri.Host
    Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
    User = [Uri]::UnescapeDataString($userInfoParts[0])
    Password = [Uri]::UnescapeDataString($userInfoParts[1])
    Database = $databaseName
    SslMode = $sslMode
  }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
$script:LogPath = Join-Path $resolvedOutput 'taskflow-backup.log'
$databaseUrl = $null
$databaseSettings = $null
$environmentNames = @('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGCONNECT_TIMEOUT')
$previousEnvironment = @{}

foreach ($environmentName in $environmentNames) {
  $previousEnvironment[$environmentName] = [Environment]::GetEnvironmentVariable($environmentName, 'Process')
}

try {
  & docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker is not available. Start Docker Desktop before running the backup.'
  }

  $databaseUrl = ConvertFrom-BackupCredential -Path $CredentialPath
  $databaseSettings = Get-DatabaseSettings -DatabaseUrl $databaseUrl

  $env:PGHOST = $databaseSettings.Host
  $env:PGPORT = [string]$databaseSettings.Port
  $env:PGUSER = $databaseSettings.User
  $env:PGPASSWORD = $databaseSettings.Password
  $env:PGDATABASE = $databaseSettings.Database
  $env:PGSSLMODE = $databaseSettings.SslMode
  $env:PGCONNECT_TIMEOUT = '30'

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $dumpName = "taskflow-public-$stamp.dump"
  $dumpPath = Join-Path $resolvedOutput $dumpName
  $containerDumpPath = "/backup/$dumpName"
  $mount = "type=bind,source=$resolvedOutput,target=/backup"

  Write-BackupLog "Starting database backup to $dumpName."

  $dumpArguments = @(
    'run', '--rm',
    '-e', 'PGHOST', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD',
    '-e', 'PGDATABASE', '-e', 'PGSSLMODE', '-e', 'PGCONNECT_TIMEOUT',
    '--mount', $mount,
    $PostgresImage,
    'pg_dump', '--format=custom', '--compress=6', '--no-owner', '--no-privileges',
    "--schema=$Schema", '--file', $containerDumpPath
  )
  & docker @dumpArguments
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) {
    throw 'pg_dump did not create the expected archive.'
  }
  if ((Get-Item -LiteralPath $dumpPath).Length -le 0) {
    throw 'pg_dump created an empty archive.'
  }

  $verifyArguments = @(
    'run', '--rm', '--mount', $mount, $PostgresImage,
    'pg_restore', '--list', $containerDumpPath
  )
  & docker @verifyArguments *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'pg_restore could not read the new archive.'
  }

  $hash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $checksumPath = "$dumpPath.sha256"
  Set-Content -LiteralPath $checksumPath -Value "$hash  $dumpName" -Encoding ASCII

  $expiredDumps = Get-ChildItem -LiteralPath $resolvedOutput -Filter 'taskflow-public-*.dump' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepBackups

  foreach ($expiredDump in $expiredDumps) {
    Remove-Item -LiteralPath $expiredDump.FullName -Force
    $expiredChecksum = "$($expiredDump.FullName).sha256"
    if (Test-Path -LiteralPath $expiredChecksum -PathType Leaf) {
      Remove-Item -LiteralPath $expiredChecksum -Force
    }
  }

  Write-BackupLog "Backup verified: $dumpName (SHA-256 $hash)."
  Write-Output $dumpPath
} catch {
  Write-BackupLog $_.Exception.Message 'ERROR'
  throw
} finally {
  $databaseUrl = $null
  $databaseSettings = $null
  foreach ($environmentName in $environmentNames) {
    $oldValue = $previousEnvironment[$environmentName]
    if ($null -eq $oldValue) {
      [Environment]::SetEnvironmentVariable($environmentName, $null, 'Process')
    } else {
      [Environment]::SetEnvironmentVariable($environmentName, $oldValue, 'Process')
    }
  }
}
