param([string]$OutputPath = ".env.fingerprint")
$machineGuid = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid
try { $volume = (Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction Stop).VolumeSerialNumber } catch { $volume = 'no-volume-api' }
$bytes = [Text.Encoding]::UTF8.GetBytes("$machineGuid|$volume")
$hash = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$fingerprint = ([BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
$line = "HOST_FINGERPRINT=$fingerprint"
Set-Content -LiteralPath $OutputPath -Value $line -Encoding ascii
Write-Output "Fingerprint written to $OutputPath"
