[CmdletBinding()]
param([Parameter(Mandatory)][string]$PostgresContainer)
$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = (Resolve-Path (Join-Path $demoRoot '../..')).Path
$apiProject = Join-Path $repoRoot 'modules/back-end/src/Api/Api.csproj'
$keyPath = Join-Path $demoRoot '.local/api-root-key'
if (-not (Test-Path -LiteralPath (Split-Path $keyPath))) { New-Item -ItemType Directory -Path (Split-Path $keyPath) | Out-Null }
if (-not (Test-Path -LiteralPath $keyPath)) {
    [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) | Set-Content -LiteralPath $keyPath -NoNewline
}
$settings = @{
    'ReleaseHealth:Credentials:ActiveKeyId' = 'local-v1'
    'ReleaseHealth:Credentials:Keys:local-v1' = (Get-Content -LiteralPath $keyPath -Raw).Trim()
    'ReleaseHealth:Development:AllowedLoopbackOrigins:0' = 'http://127.0.0.1:19181'
}
# stdin avoids putting the encryption key in command arguments or terminal output.
$settings | ConvertTo-Json | dotnet user-secrets set --project $apiProject
if ($LASTEXITCODE -ne 0) { throw 'Failed to configure Development user-secrets.' }
Get-Content -LiteralPath (Join-Path $repoRoot 'modules/back-end/scripts/release-health/postgres.sql') -Raw | docker exec -i $PostgresContainer psql -U postgres -d featbit -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Release Health database migration failed.' }
Write-Host 'Configured only FeatBit API Development settings and the additive Release Health table. Rebuild api-server through Aspire.'
Write-Host 'Development user-secrets are not a production vault. Keep the local root key file private and backed up.'
