$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
    aspire stop --non-interactive
}
finally {
    Pop-Location
}
