[CmdletBinding()]
param()
$demoRoot = Split-Path $PSScriptRoot -Parent
# Keep the named Prometheus volume and local test credentials for inspection/restarts.
docker compose -f (Join-Path $demoRoot 'compose.yaml') down
if ($LASTEXITCODE -ne 0) { throw 'Demo shutdown failed.' }
