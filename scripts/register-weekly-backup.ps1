[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Taskflow\backup-database-url.xml'),
  [ValidateSet('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')][string]$DayOfWeek = 'Sunday',
  [datetime]$At = '12:00',
  [ValidateRange(2, 52)][int]$KeepWeeks = 12
)

$ErrorActionPreference = 'Stop'
$dailyRegistrationScript = Join-Path $PSScriptRoot 'register-daily-backup.ps1'
$keepBackups = $KeepWeeks * 7

Write-Warning 'The weekly registration command is deprecated. Registering the required daily 12:00 Vietnam-time task instead.'

& $dailyRegistrationScript `
  -OutputDirectory $OutputDirectory `
  -CredentialPath $CredentialPath `
  -At $At `
  -KeepBackups $keepBackups
