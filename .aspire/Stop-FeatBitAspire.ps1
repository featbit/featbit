param(
    [int[]] $Ports = @(4200, 5000, 5001, 5100, 5101),
    [switch] $IncludeDocker
)

$ErrorActionPreference = "Stop"

$connections = Get-NetTCPConnection -State Listen -LocalPort $Ports -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        continue
    }

    if ($process.ProcessName -notin @("dotnet", "node", "npm", "cmd", "pwsh", "powershell")) {
        Write-Host "Skip PID $processId ($($process.ProcessName)); it is not a FeatBit Aspire dev process."
        continue
    }

    Write-Host "Stopping PID $processId ($($process.ProcessName))"
    Stop-Process -Id $processId -Force
}

if (-not $IncludeDocker) {
    return
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    Write-Host "Docker CLI was not found."
    return
}

$containers = docker ps --format "{{.ID}}|{{.Image}}|{{.Ports}}"
foreach ($container in $containers) {
    $parts = $container -split "\|", 3
    if ($parts.Count -ne 3) {
        continue
    }

    $id = $parts[0]
    $image = $parts[1]
    $portsText = $parts[2]

    $isFeatBitContainer =
        $image -like "postgres*" -or
        $image -like "featbit/featbit-data-analytics-server*"

    $usesFixedPort =
        $portsText -match "(:|0\.0\.0\.0:|\[::\]:)(5432|8200)->"

    if ($isFeatBitContainer -and $usesFixedPort) {
        Write-Host "Stopping container $id ($image)"
        docker stop $id | Out-Null
    }
}
