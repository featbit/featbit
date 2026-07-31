<#
.SYNOPSIS
    Stops all FeatBit port forwards.

.DESCRIPTION
    Kills all kubectl port-forward processes related to FeatBit services.

.EXAMPLE
    .\Stop-PortForwards.ps1
    Stops all port forwards immediately.

.NOTES
    Author: GitHub Copilot
    Date: 2026-03-04
#>

[CmdletBinding()]
param()

Write-Host "Stopping all port forwards..." -ForegroundColor Yellow

# Kill all kubectl processes
$kubectlProcesses = Get-Process kubectl -ErrorAction SilentlyContinue
if ($kubectlProcesses) {
    Write-Host "  Found $($kubectlProcesses.Count) kubectl processes" -ForegroundColor Gray
    $kubectlProcesses | Stop-Process -Force
    Write-Host "✓ All kubectl processes stopped" -ForegroundColor Green
} else {
    Write-Host "  No kubectl processes found" -ForegroundColor Gray
}

# Also stop any PowerShell processes running Start-PortForwards.ps1
$portForwardScripts = Get-WmiObject Win32_Process -Filter "name='powershell.exe'" | 
    Where-Object { $_.CommandLine -like "*Start-PortForwards.ps1*" }

if ($portForwardScripts) {
    Write-Host "  Found port forward manager processes" -ForegroundColor Gray
    $portForwardScripts | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "✓ Port forward manager stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "✓ All port forwards stopped" -ForegroundColor Green
