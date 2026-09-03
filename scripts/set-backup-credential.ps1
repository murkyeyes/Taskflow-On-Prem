[CmdletBinding()]
param(
  [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Taskflow\backup-database-url.xml')
)

$ErrorActionPreference = 'Stop'

$credentialDirectory = Split-Path -Parent $CredentialPath
if ([string]::IsNullOrWhiteSpace($credentialDirectory)) {
  throw 'CredentialPath must include a parent directory.'
}

$databaseUrl = Read-Host 'Paste the Supabase Session pooler database URI' -AsSecureString
$plainDatabaseUrl = $null
$secretPointer = [IntPtr]::Zero

try {
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseUrl)
  $plainDatabaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $parsedUri = [Uri]$plainDatabaseUrl

  if ($parsedUri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'The value must be a postgresql:// database URI.'
  }
  if ([string]::IsNullOrWhiteSpace($parsedUri.Host) -or [string]::IsNullOrWhiteSpace($parsedUri.UserInfo)) {
    throw 'The database URI must include a host, user, and password.'
  }
} finally {
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  $plainDatabaseUrl = $null
}

New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
$databaseUrl | Export-Clixml -LiteralPath $CredentialPath -Force

Write-Output "Encrypted backup credential saved for the current Windows account: $CredentialPath"
Write-Output 'Only this Windows account on this computer can decrypt it.'
