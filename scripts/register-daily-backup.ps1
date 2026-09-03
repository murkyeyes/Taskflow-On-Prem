[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Taskflow\backup-database-url.xml'),
  [datetime]$At = '12:00',
  [ValidateRange(2, 365)][int]$KeepBackups = 84,
  [string]$TaskName = 'Taskflow Daily Database Backup',
  [string]$LegacyTaskName = 'Taskflow Weekly Database Backup'
)

$ErrorActionPreference = 'Stop'
$vietnamWindowsTimeZone = 'SE Asia Standard Time'
$currentTimeZone = Get-TimeZone

if ($currentTimeZone.Id -ne $vietnamWindowsTimeZone) {
  throw "Windows time zone must be '$vietnamWindowsTimeZone' so 12:00 is Vietnam time. Current time zone: '$($currentTimeZone.Id)'."
}

if (-not (Test-Path -LiteralPath $CredentialPath -PathType Leaf)) {
  throw "Backup credential not found: $CredentialPath. Run scripts\set-backup-credential.ps1 first."
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
$resolvedCredential = (Resolve-Path -LiteralPath $CredentialPath).Path
$backupScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'backup-supabase-daily.ps1')).Path
$powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$windowsAccount = [Security.Principal.WindowsIdentity]::GetCurrent().Name

$actionArguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -OutputDirectory "{1}" -CredentialPath "{2}" -KeepBackups {3}' -f `
  $backupScript, $resolvedOutput, $resolvedCredential, $KeepBackups

$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $actionArguments
$trigger = New-ScheduledTaskTrigger -Daily -DaysInterval 1 -At $At
$principal = New-ScheduledTaskPrincipal -UserId $windowsAccount -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

if ($LegacyTaskName -ne $TaskName) {
  $legacyTask = Get-ScheduledTask -TaskName $LegacyTaskName -ErrorAction SilentlyContinue
  if ($null -ne $legacyTask) {
    Unregister-ScheduledTask -TaskName $LegacyTaskName -Confirm:$false
    Write-Output "Removed superseded weekly task: $LegacyTaskName"
  }
}

Write-Output "Scheduled task registered: $TaskName"
Write-Output "Schedule: every day at $($At.ToString('HH:mm')) Vietnam time ($vietnamWindowsTimeZone)"
Write-Output "Destination: $resolvedOutput"
Write-Output 'This DPAPI-backed task runs as the current Windows account while that account is signed in.'
