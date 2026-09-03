[CmdletBinding()]
param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '.env'),
  [string]$TaskName = 'Taskflow Supabase Backup',
  [string[]]$BackupTimes = @('00:00', '06:00', '12:00', '18:00'),
  [switch]$RunNow,
  [switch]$KeepLegacyTasks,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $ValidateOnly -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script from PowerShell opened with Run as administrator.'
}
if ((Get-TimeZone).Id -ne 'SE Asia Standard Time') {
  throw "Windows time zone must be 'SE Asia Standard Time' so 00:00, 06:00, 12:00, and 18:00 are Vietnam time."
}
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw "Backup configuration was not found: $EnvFile" }

$backupScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'backup-supabase.ps1')).Path
$resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
$parsedTimes = foreach ($time in $BackupTimes) {
  $parsed = [DateTime]::MinValue
  if (-not [DateTime]::TryParseExact($time, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$parsed)) {
    throw "Invalid backup time '$time'. Use 24-hour HH:mm format."
  }
  $parsed.ToString('HH:mm')
}
if (@($parsedTimes).Count -lt 1) { throw 'At least one backup time is required.' }
$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -EnvFile "{1}"' -f $backupScript, $resolvedEnvFile

if ($ValidateOnly) {
  Write-Output "Validation succeeded for task '$TaskName'."
  Write-Output "Schedule: $($parsedTimes -join ', ') (Windows SE Asia Standard Time)."
  Write-Output "Action: $powerShell $arguments"
  Write-Output 'Trigger count validated; identity: SYSTEM; StartWhenAvailable: True; restart attempts: 3.'
  return
}

$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $PSScriptRoot
$triggers = $parsedTimes | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$description = "Direct Supabase PostgreSQL custom-format backup at $($parsedTimes -join ', ') Vietnam time."
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Principal $taskPrincipal -Settings $settings -Description $description -Force | Out-Null

if (-not $KeepLegacyTasks) {
  foreach ($legacyName in @('Taskflow Daily Database Backup', 'Taskflow Weekly Database Backup')) {
    if (Get-ScheduledTask -TaskName $legacyName -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $legacyName -Confirm:$false
      Write-Output "Removed legacy task: $legacyName"
    }
  }
}

$registeredTask = Get-ScheduledTask -TaskName $TaskName
Write-Output "Registered task: $($registeredTask.TaskName)"
Write-Output "Schedule: every day at $($parsedTimes -join ', ') (Windows SE Asia Standard Time)."
Write-Output 'Identity: SYSTEM; StartWhenAvailable enabled; restart attempts: 3.'
if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Output 'Started one test run. Review the configured backup folder and logs\backup.log.'
}
