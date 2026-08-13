<#
.SYNOPSIS
    Initialize MongoDB Replica Set across East and West clusters

.DESCRIPTION
    This script initializes a MongoDB replica set spanning both clusters,
    configures priorities, and verifies the replica set status.

.NOTES
    Prerequisites:
    - MongoDB pods must be running in both clusters
    - Port forwards must be active
    - MongoDB LoadBalancer services must be exposed
#>

param(
    [string]$WestContext = "west",
    [string]$EastContext = "east",
    [string]$MongoUsername = "admin",
    [string]$MongoPassword = "password",
    [string]$MongoAuthDatabase = "admin",
    [string]$WestNodeIp = "172.31.0.10",
    [string]$EastNodeIp = "172.31.0.20"
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Get-MongoPods {
    param(
        [string]$Context,
        [string[]]$Selectors
    )

    foreach ($selector in $Selectors) {
        $podNames = kubectl --context $Context get pods -n featbit -l $selector -o jsonpath='{.items[*].metadata.name}' 2>$null
        if ($podNames) {
            return [pscustomobject]@{
                Selector = $selector
                Pods = @($podNames -split '\s+' | Where-Object { $_ })
            }
        }
    }

    return [pscustomobject]@{
        Selector = $null
        Pods = @()
    }
}

function Get-ServiceNodePortAddress {
    param(
        [string]$Context,
        [string[]]$ServiceNames,
        [string]$NodeIp
    )

    foreach ($serviceName in $ServiceNames) {
        $nodePort = kubectl --context $Context get svc $serviceName -n featbit -o jsonpath='{.spec.ports[0].nodePort}' 2>$null
        if ($nodePort -and $LASTEXITCODE -eq 0) {
            return [pscustomobject]@{
                ServiceName = $serviceName
                Address     = "${NodeIp}:${nodePort}"
            }
        }
    }

    return $null
}

function Get-FirstServiceLoadBalancerIp {
    param(
        [string]$Context,
        [string[]]$ServiceNames
    )

    foreach ($serviceName in $ServiceNames) {
        $ip = kubectl --context $Context get svc $serviceName -n featbit -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
        if ($ip) {
            return [pscustomobject]@{
                ServiceName = $serviceName
                Ip = $ip
            }
        }
    }

    return $null
}

function Get-ReplicaSetNameFromPod {
    param(
        [string]$Context,
        [string]$PodName
    )

    $commandText = kubectl --context $Context get pod $PodName -n featbit -o jsonpath='{.spec.containers[0].command[*]} {.spec.containers[0].args[*]}' 2>$null
    if ($commandText -and $commandText -match '--replSet\s+([^\s]+)') {
        return $Matches[1]
    }

    return "rs0"
}

function Invoke-MongoEval {
    param(
        [string]$Context,
        [string]$PodName,
        [string]$Eval,
        [bool]$UseAuthentication
    )

    $arguments = @(
        "--context", $Context,
        "exec", "-n", "featbit", $PodName,
        "--",
        "mongosh",
        "--quiet"
    )

    if ($UseAuthentication) {
        $arguments += @(
            "--username", $MongoUsername,
            "--password", $MongoPassword,
            "--authenticationDatabase", $MongoAuthDatabase
        )
    }

    $arguments += @("--eval", $Eval)

    $output = & kubectl @arguments 2>&1
    return [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = $output
    }
}

function Invoke-MongoScript {
    param(
        [string]$Context,
        [string]$PodName,
        [string]$Script,
        [bool]$UseAuthentication,
        [string]$DatabaseName
    )

    $arguments = @(
        "--context", $Context,
        "exec", "-i", "-n", "featbit", $PodName,
        "--",
        "mongosh",
        "--quiet"
    )

    if ($UseAuthentication) {
        $arguments += @(
            "--username", $MongoUsername,
            "--password", $MongoPassword,
            "--authenticationDatabase", $MongoAuthDatabase
        )
    }

    if ($DatabaseName) {
        $arguments += $DatabaseName
    }

    $output = $Script | & kubectl @arguments 2>&1
    return [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = $output
    }
}

function Test-MongoHostReachable {
    param(
        [string]$Context,
        [string]$PodName,
        [string]$MongoHost,
        [int]$Port = 27017,
        [int]$Attempts = 3,
        [int]$DelaySeconds = 5
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        $result = kubectl --context $Context exec -n featbit $PodName -- mongosh "mongodb://${MongoHost}:${Port}/admin" --quiet --eval "db.adminCommand({ ping: 1 })" 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }

        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    return $false
}

function Test-ReplicaSetPrimaryAvailable {
    param(
        [string]$Context,
        [string]$PodName,
        [bool]$UseAuthentication
    )

    $statusResult = Invoke-MongoEval -Context $Context -PodName $PodName -Eval "JSON.stringify(rs.status().members.map(m => ({name:m.name,state:m.stateStr})))" -UseAuthentication $UseAuthentication

    if ($statusResult.ExitCode -ne 0 -and $UseAuthentication -and ($statusResult.Output -join "`n") -match "Authentication failed") {
        $statusResult = Invoke-MongoEval -Context $Context -PodName $PodName -Eval "JSON.stringify(rs.status().members.map(m => ({name:m.name,state:m.stateStr})))" -UseAuthentication $false
    }

    if ($statusResult.ExitCode -ne 0) {
        return [pscustomobject]@{
            IsAvailable = $false
            Members = @()
            Error = ($statusResult.Output -join "`n")
        }
    }

    try {
        $members = $statusResult.Output | ConvertFrom-Json
        $hasPrimary = $members | Where-Object { $_.state -eq "PRIMARY" }

        return [pscustomobject]@{
            IsAvailable = [bool]$hasPrimary
            Members = @($members)
            Error = $null
        }
    }
    catch {
        return [pscustomobject]@{
            IsAvailable = $false
            Members = @()
            Error = $_.Exception.Message
        }
    }
}

Write-Header "MongoDB Replica Set Initialization"

# Step 1: Check if MongoDB pods are running
Write-Info "Checking MongoDB pods..."

$westResult = Get-MongoPods -Context $WestContext -Selectors @("app=mongodb-west", "app=mongodb,region=west", "app=mongodb")
$eastResult = Get-MongoPods -Context $EastContext -Selectors @("app=mongodb-east", "app=mongodb,region=east", "app=mongodb")

$westPods = $westResult.Pods
$eastPods = $eastResult.Pods

if (-not $westPods) {
    Write-Error "No MongoDB pods found in West cluster"
    Write-Info "Checked selectors: app=mongodb-west, app=mongodb,region=west, app=mongodb"
    exit 1
}

if (-not $eastPods) {
    Write-Error "No MongoDB pods found in East cluster"
    Write-Info "Checked selectors: app=mongodb-east, app=mongodb,region=east, app=mongodb"
    Write-Host ""
    Write-Host "MongoDB must be deployed first. Run one of the following:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Option 1: Full deployment (recommended)" -ForegroundColor Cyan
    Write-Host "    .\Deploy-FeatBitClusters.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "  Option 2: Deploy only MongoDB" -ForegroundColor Cyan
    Write-Host "    kubectl --context west apply -f .\kubernetes\pro\infrastructure\mongodb-init-configMap.yaml -n featbit" -ForegroundColor White
    Write-Host "    kubectl --context west apply -f .\kubernetes\pro\infrastructure\mongodb-west-statefulset.yaml -n featbit" -ForegroundColor White
    Write-Host "    kubectl --context east apply -f .\kubernetes\pro\infrastructure\mongodb-east-statefulset.yaml -n featbit" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Success "Found MongoDB pods in both clusters"
Write-Info "West selector: $($westResult.Selector)"
Write-Info "West: $($westPods -join ', ')"
Write-Info "East selector: $($eastResult.Selector)"
Write-Info "East: $($eastPods -join ', ')"
Write-Host ""

# Step 2: Wait for MongoDB to be ready
Write-Info "Waiting for MongoDB pods to be ready..."

kubectl --context $WestContext wait --for=condition=ready pod -n featbit -l $westResult.Selector --timeout=120s
kubectl --context $EastContext wait --for=condition=ready pod -n featbit -l $eastResult.Selector --timeout=120s

Write-Success "All MongoDB pods are ready"
Write-Host ""

# Pick a west pod to run mongosh commands from
$westPrimaryPod = $westPods | Sort-Object | Select-Object -First 1
$replicaSetName = Get-ReplicaSetNameFromPod -Context $WestContext -PodName $westPrimaryPod
$useAuthentication = $true

Write-Info "Using west pod for MongoDB commands: $westPrimaryPod"
Write-Info "Detected replica set name: $replicaSetName"
Write-Host ""

# Step 4: Initialize replica set
Write-Header "Initializing Replica Set"

Write-Info "Connecting to $westPrimaryPod in west cluster..."

# Get MongoDB addresses via NodePort + shared Docker network node IPs
$westPrimaryService = Get-ServiceNodePortAddress -Context $WestContext -ServiceNames @("mongodb-0-lb", "mongodb-west", "mongodb") -NodeIp $WestNodeIp
$westSecondaryService = Get-ServiceNodePortAddress -Context $WestContext -ServiceNames @("mongodb-1-lb") -NodeIp $WestNodeIp
$eastService = Get-ServiceNodePortAddress -Context $EastContext -ServiceNames @("mongodb-2-lb", "mongodb-east", "mongodb") -NodeIp $EastNodeIp

if (-not $westPrimaryService -or -not $eastService) {
    Write-Error "Unable to resolve MongoDB NodePort addresses from expected service names."
    Write-Info "West tried: mongodb-0-lb, mongodb-west, mongodb"
    Write-Info "East tried: mongodb-2-lb, mongodb-east, mongodb"
    exit 1
}

$westMongoAddress = $westPrimaryService.Address
$eastMongoAddress = $eastService.Address

Write-Info "West MongoDB address: $westMongoAddress"
Write-Info "East MongoDB address: $eastMongoAddress"
Write-Host ""

# Validate cross-cluster connectivity before attempting rs.initiate quorum checks
Write-Info "Validating cross-cluster MongoDB connectivity from west primary..."

$eastAddrParts = $eastMongoAddress.Split(":")
$eastReachableFromWest = Test-MongoHostReachable -Context $WestContext -PodName $westPrimaryPod -MongoHost $eastAddrParts[0] -Port ([int]$eastAddrParts[1]) -Attempts 4 -DelaySeconds 8
if (-not $eastReachableFromWest) {
    Write-Error "East MongoDB endpoint ($eastMongoAddress) is not reachable from west pod $westPrimaryPod."
    Write-Info "Ensure both minikube nodes are connected to the shared Docker network (featbit-cluster-network)."
    Write-Info "Run: .\Deploy-FeatBitClusters.ps1 -RecreateClusters -DeploymentMode Advanced"
    exit 1
}

Write-Success "Cross-cluster MongoDB connectivity verified"
Write-Host ""

# Create replica set configuration using NodePort addresses.
# West is the PRIMARY DC: west-0 gets the highest priority so the primary lives
# in west in steady state, and west (holding the 2/3 majority) keeps a writable
# primary during a cross-DC partition — the premise of CP-11/CP-12 (west =
# writable survivor, east = evicted DC). The previous config gave EAST
# priority 2, parking the primary in the DC the partition isolates: west-side
# writes (flag toggles, dc_leases renewals) then stall on server selection
# until west's delayed priority-aware election completes, and commits stall
# with them (#113).
$members = @(
    "    { _id: 0, host: '${westMongoAddress}', priority: 2 }"
)

if ($westSecondaryService) {
    $members += "    { _id: 1, host: '$($westSecondaryService.Address)', priority: 1 }"
    $members += "    { _id: 2, host: '${eastMongoAddress}', priority: 1 }"
}
else {
    $members += "    { _id: 1, host: '${eastMongoAddress}', priority: 1 }"
}

$newLine = [Environment]::NewLine
$membersBlock = $members -join ("," + $newLine)
$replicaSetConfig = "rs.initiate({$newLine  _id: '$replicaSetName',$newLine  members: [$newLine$membersBlock$newLine  ]$newLine})"
$replicaSetReconfig = "cfg = rs.conf(); cfg.members = [$newLine$membersBlock$newLine  ]; cfg.version = cfg.version + 1; rs.reconfig(cfg, { force: true })"

Write-Info "Replica set configuration:"
Write-Host $replicaSetConfig -ForegroundColor Gray
Write-Host ""

# Execute initialization from within the west mongodb pod
Write-Info "Executing rs.initiate() from within $westPrimaryPod..."

$maxInitAttempts = 8
$initRetryDelaySeconds = 15

try {
    $initResult = $null

    for ($attempt = 1; $attempt -le $maxInitAttempts; $attempt++) {
        $initResult = Invoke-MongoEval -Context $WestContext -PodName $westPrimaryPod -Eval $replicaSetConfig -UseAuthentication $true

        if ($initResult.ExitCode -ne 0 -and ($initResult.Output -join "`n") -match "Authentication failed") {
            Write-Info "Authentication failed with configured credentials; retrying without authentication..."
            $initResult = Invoke-MongoEval -Context $WestContext -PodName $westPrimaryPod -Eval $replicaSetConfig -UseAuthentication $false
            if ($initResult.ExitCode -eq 0) {
                $useAuthentication = $false
            }
    }

        if ($initResult.ExitCode -eq 0) {
            break
        }

        $initOutput = $initResult.Output -join "`n"

        if ($initOutput -match "already initialized|already been initialized") {
            break
        }

        $isTransientConnectivityIssue = $initOutput -match "quorum check failed|Couldn't get a connection within the time limit|NodeNotFound|connection timed out|host unreachable"
        if ($isTransientConnectivityIssue -and $attempt -lt $maxInitAttempts) {
            Write-Info "Replica set initiation attempt $attempt/$maxInitAttempts hit transient connectivity. Retrying in $initRetryDelaySeconds seconds..."
            Start-Sleep -Seconds $initRetryDelaySeconds
            continue
        }

        break
    }

    if ($null -eq $initResult) {
        Write-Error "Replica set initialization did not execute."
        exit 1
    }

    if ($initResult.ExitCode -eq 0) {
        Write-Success "Replica set initialized successfully"
        Write-Host $initResult.Output -ForegroundColor Gray
    } elseif (($initResult.Output -join "`n") -match "already initialized|already been initialized") {
        Write-Info "Replica set already initialized. Reconfiguring members to current LoadBalancer endpoints..."

        $reconfigResult = Invoke-MongoEval -Context $WestContext -PodName $westPrimaryPod -Eval $replicaSetReconfig -UseAuthentication $useAuthentication

        if ($reconfigResult.ExitCode -ne 0 -and $useAuthentication -and ($reconfigResult.Output -join "`n") -match "Authentication failed") {
            Write-Info "Authentication failed during reconfig; retrying without authentication..."
            $reconfigResult = Invoke-MongoEval -Context $WestContext -PodName $westPrimaryPod -Eval $replicaSetReconfig -UseAuthentication $false
            if ($reconfigResult.ExitCode -eq 0) {
                $useAuthentication = $false
            }
        }

        if ($reconfigResult.ExitCode -eq 0) {
            Write-Success "Replica set reconfigured successfully"
            Write-Host $reconfigResult.Output -ForegroundColor Gray
        } else {
            Write-Error "Failed to reconfigure existing replica set"
            Write-Host $reconfigResult.Output -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Error "Failed to initialize replica set"
        Write-Host $initResult.Output -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Error "Error initializing replica set: $_"
    exit 1
}

Write-Host ""

# Step 5: Wait for replica set to stabilize
Write-Info "Waiting for replica set to stabilize (30 seconds)..."
Start-Sleep -Seconds 30

# Step 6: Check replica set status
Write-Header "Replica Set Status"

Write-Info "Getting replica set status..."

try {
    $statusResult = Invoke-MongoEval -Context $WestContext -PodName $westPrimaryPod -Eval "JSON.stringify(rs.status().members.map(m => ({name:m.name,state:m.stateStr,health:m.health})))" -UseAuthentication $useAuthentication

    if ($statusResult.ExitCode -ne 0 -and $useAuthentication -and ($statusResult.Output -join "`n") -match "Authentication failed") {
        Write-Info "Authentication failed while checking status; retrying without authentication..."
        $statusResult = Invoke-MongoEval -Context $WestContext -PodName $westPrimaryPod -Eval "JSON.stringify(rs.status().members.map(m => ({name:m.name,state:m.stateStr,health:m.health})))" -UseAuthentication $false
        if ($statusResult.ExitCode -eq 0) {
            $useAuthentication = $false
        }
    }

    if ($statusResult.ExitCode -eq 0) {
        Write-Success "Replica set is operational"
        Write-Host ""
        Write-Host "Members:" -ForegroundColor Yellow

        $membersStatus = $statusResult.Output | ConvertFrom-Json
        foreach ($member in $membersStatus) {
            $color = if ($member.state -eq "PRIMARY") { "Green" } elseif ($member.state -eq "SECONDARY") { "Cyan" } else { "Yellow" }
            Write-Host "  $($member.name): $($member.state) (health: $($member.health))" -ForegroundColor $color
        }
    } else {
        Write-Error "Failed to get replica set status"
        Write-Host $statusResult.Output -ForegroundColor Red
    }
} catch {
    Write-Error "Error checking replica set status: $_"
}

Write-Host ""

# Step 7: Initialize database (run seed script on primary)
Write-Header "Initializing Database"

Write-Info "Running database initialization script..."

$scriptDirectory = $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$fallbackSeedScriptPath = Join-Path $repoRoot "infra\mongodb\docker-entrypoint-initdb.d\v0.0.0.js"

# Get the init script from ConfigMap
$initScript = kubectl --context $WestContext get configmap -n featbit mongodb-init -o jsonpath='{.data.init\.js}' 2>$null

if (-not $initScript -and (Test-Path $fallbackSeedScriptPath)) {
    Write-Info "mongodb-init ConfigMap not found; using fallback seed script: $fallbackSeedScriptPath"
    $initScript = Get-Content -Raw $fallbackSeedScriptPath
}

if ($initScript) {
    # Find the actual PRIMARY address from replica set status
    $rsStatusRaw = Invoke-MongoEval -Context $WestContext -PodName $westPrimaryPod -Eval "JSON.stringify(rs.status().members.map(m=>({name:m.name,state:m.stateStr})))" -UseAuthentication $useAuthentication

    $primaryAddress = $null
    if ($rsStatusRaw.ExitCode -eq 0) {
        try {
            $rsMembers = $rsStatusRaw.Output | ConvertFrom-Json
            $primaryMember = $rsMembers | Where-Object { $_.state -eq "PRIMARY" } | Select-Object -First 1
            if ($primaryMember) {
                $primaryAddress = $primaryMember.name
            }
        }
        catch { }
    }

    if (-not $primaryAddress) {
        Write-Error "Replica set has no PRIMARY member. Seeding requires a writable primary and has been aborted."
        Write-Info "Recovery: wait for election to complete then rerun this script."
        exit 1
    }

    Write-Info "Seeding database on PRIMARY: $primaryAddress"

    # Run seed from west pod, directing to the PRIMARY NodePort address.
    # west pod can reach NodePort addresses on both nodes via the shared Docker network.
    $seedArguments = @(
        "--context", $WestContext,
        "exec", "-i", "-n", "featbit", $westPrimaryPod,
        "--",
        "mongosh",
        "--quiet",
        "mongodb://${primaryAddress}/featbit?directConnection=true"
    )

    try {
        $seedOutput = $initScript | & kubectl @seedArguments 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database initialized with seed data"
        }
        else {
            Write-Error "Database initialization command failed"
            Write-Host $seedOutput -ForegroundColor Red
        }
    }
    catch {
        Write-Error "Error initializing database: $_"
    }
} else {
    Write-Info "No init script found in ConfigMap, skipping seed data"
}

Write-Host ""

# Summary
Write-Header "Summary"

Write-Host "MongoDB Replica Set Configuration:" -ForegroundColor Yellow
Write-Host "  • Replica Set Name: rs-featbit" -ForegroundColor Gray
Write-Host "  • Members: 3 (2 in West, 1 in East)" -ForegroundColor Gray
Write-Host "  • Primary: mongodb-0.west.local:27017 (preferred)" -ForegroundColor Gray
Write-Host ""

Write-Host "Connection String:" -ForegroundColor Yellow
Write-Host '  mongodb://admin:password@mongodb-0.west.local:27017,mongodb-1.west.local:27018,mongodb-2.east.local:27019/featbit?replicaSet=rs-featbit&authSource=admin' -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Update FeatBit application ConfigMaps with replica set connection string" -ForegroundColor Gray
Write-Host "  2. Restart FeatBit pods to use the new connection string" -ForegroundColor Gray
Write-Host "  3. Verify data replication with: rs.printReplicationInfo()" -ForegroundColor Gray
Write-Host ""

Write-Success "MongoDB replica set is ready!"
