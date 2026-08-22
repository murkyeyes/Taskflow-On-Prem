[CmdletBinding()]
param(
  [string]$Container = 'taskflow-on-prem-db-1',
  [string]$Database = 'taskflow',
  [string]$User = 'taskflow',
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups'),
  [int]$Keep = 14
)
$ErrorActionPreference = 'Stop'
if ($Keep -lt 7 -or $Keep -gt 14) { throw 'Keep must be between 7 and 14.' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$name = "taskflow-$stamp.dump"
$hostPath = [IO.Path]::GetFullPath((Join-Path $OutputDirectory $name))
$containerPath = "/tmp/$name"
try {
  & docker exec $Container pg_dump -U $User -d $Database -Fc -f $containerPath
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
  & docker cp "${Container}:$containerPath" $hostPath
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $hostPath)) { throw 'Unable to copy backup from container.' }
} finally { & docker exec $Container rm -f $containerPath 2>$null | Out-Null }
Get-ChildItem -LiteralPath $OutputDirectory -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item -Force
Write-Output "Backup created: $name"
