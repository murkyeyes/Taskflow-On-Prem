[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Taskflow\backup-database-url.xml'),
  [ValidateRange(2, 365)][int]$KeepBackups = 84,
  [string]$PostgresImage = 'postgres:17-alpine',
  [ValidatePattern('^[a-zA-Z_][a-zA-Z0-9_]*$')][string]$Schema = 'public'
)

$ErrorActionPreference = 'Stop'
$backupScript = Join-Path $PSScriptRoot 'backup-supabase-weekly.ps1'

& $backupScript `
  -OutputDirectory $OutputDirectory `
  -CredentialPath $CredentialPath `
  -KeepBackups $KeepBackups `
  -PostgresImage $PostgresImage `
  -Schema $Schema

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
