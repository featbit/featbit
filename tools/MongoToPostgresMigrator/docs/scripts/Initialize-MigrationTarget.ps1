#Requires -Version 5.1
<#
.SYNOPSIS
    Provisions a FeatBit PostgreSQL migration target and empties its domain
    tables, ready for MongoToPostgresMigrator.

.DESCRIPTION
    Run this from a developer workstation that has the `psql` client on PATH and
    network access to the target PostgreSQL instance (an external managed
    instance for dev/test/prod, or a local container for testing).

    By default it:
      1. Creates the target database if it does not already exist.
      2. Applies every versioned schema init script in version order
         (infra/postgresql/docker-entrypoint-initdb.d, v0.0.0 -> latest),
         so the target always matches the current schema.
      3. Truncates the 29 domain tables so the migrator's empty-target preflight
         passes.

    Use -TruncateOnly to skip schema provisioning and only empty the domain
    tables (e.g. to reset the target for a re-run after a failed migration).

    The tool is a one-way MongoDB -> PostgreSQL migration helper. See
    ../local-testing.md and ../production-cutover.md.

.PARAMETER PgHost
    Target PostgreSQL host.

.PARAMETER Port
    Target PostgreSQL port (default 5432).

.PARAMETER Database
    Target database name (default 'featbit').

.PARAMETER Username
    PostgreSQL user with rights to create the schema (and the database, unless it
    already exists).

.PARAMETER Password
    Password for -Username. If omitted, the PGPASSWORD environment variable is
    used.

.PARAMETER MaintenanceDatabase
    Database to connect to for the initial existence check / CREATE DATABASE
    (default 'postgres'). The init scripts then \connect to the target.

.PARAMETER InitScriptsDir
    Location of the versioned init scripts. Defaults to the repo's
    infra/postgresql/docker-entrypoint-initdb.d relative to this script.

.PARAMETER TruncateOnly
    Skip schema provisioning; only truncate the domain tables.

.PARAMETER SkipDatabaseCreate
    Do not attempt CREATE DATABASE (use when the managed instance's database is
    pre-provisioned and your user cannot create databases).

.EXAMPLE
    $env:PGPASSWORD = '...'
    .\Initialize-MigrationTarget.ps1 -PgHost pg.dev.example.com -Username featbit_admin

.EXAMPLE
    # reset the target between migration attempts
    .\Initialize-MigrationTarget.ps1 -PgHost localhost -Port 5433 -Username postgres -TruncateOnly
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PgHost,
    [int]$Port = 5432,
    [string]$Database = 'featbit',
    [Parameter(Mandatory)][string]$Username,
    [string]$Password,
    [string]$MaintenanceDatabase = 'postgres',
    [string]$InitScriptsDir = (Join-Path $PSScriptRoot '..\..\..\..\infra\postgresql\docker-entrypoint-initdb.d'),
    [switch]$TruncateOnly,
    [switch]$SkipDatabaseCreate
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "The 'psql' client was not found on PATH. Install the PostgreSQL client tools and retry."
}

if ($Password) { $env:PGPASSWORD = $Password }
if (-not $env:PGPASSWORD) {
    throw "Provide -Password or set the PGPASSWORD environment variable."
}

function Invoke-PsqlFile {
    param([Parameter(Mandatory)][string]$DbName, [Parameter(Mandatory)][string]$Path)
    & psql -v ON_ERROR_STOP=1 --no-psqlrc -h $PgHost -p $Port -U $Username -d $DbName -f $Path
    if ($LASTEXITCODE -ne 0) { throw "psql failed running '$Path' (exit $LASTEXITCODE)." }
}

function Invoke-PsqlScalar {
    param([Parameter(Mandatory)][string]$DbName, [Parameter(Mandatory)][string]$Sql)
    $out = & psql -v ON_ERROR_STOP=1 --no-psqlrc -tAq -h $PgHost -p $Port -U $Username -d $DbName -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql query failed (exit $LASTEXITCODE)." }
    return ($out | Select-Object -First 1)
}

$truncateSql = Join-Path $PSScriptRoot 'truncate-domain-tables.sql'
if (-not (Test-Path $truncateSql)) { throw "Missing companion script: $truncateSql" }

if (-not $TruncateOnly) {
    $resolvedDir = (Resolve-Path $InitScriptsDir).Path
    Write-Host "Applying schema from: $resolvedDir"

    # 1. Ensure the target database exists.
    if (-not $SkipDatabaseCreate) {
        $exists = Invoke-PsqlScalar -DbName $MaintenanceDatabase `
            -Sql "SELECT 1 FROM pg_database WHERE datname = '$Database';"
        if ($exists -ne '1') {
            Write-Host "Creating database '$Database'..."
            [void](Invoke-PsqlScalar -DbName $MaintenanceDatabase -Sql "CREATE DATABASE $Database;")
        }
        else {
            Write-Host "Database '$Database' already exists; skipping CREATE DATABASE."
        }
    }

    # 2. Apply every init script in version order. Each script issues
    #    \connect featbit, so we run them against the maintenance database and
    #    let psql switch. The very first script also contains
    #    'create database featbit;' — strip it (the database is guaranteed to
    #    exist by step 1) so re-running against an existing database is clean.
    $scripts = Get-ChildItem -Path $resolvedDir -Filter '*.sql' |
        Sort-Object { [version]($_.BaseName.TrimStart('v')) }

    if (-not $scripts) { throw "No .sql init scripts found in $resolvedDir." }

    $tempFiles = @()
    try {
        foreach ($script in $scripts) {
            $content = Get-Content $script.FullName -Raw
            $content = $content -replace '(?im)^\s*create\s+database\s+\w+\s*;', ''
            $temp = New-TemporaryFile
            $tempFiles += $temp
            Set-Content -Path $temp.FullName -Value $content -NoNewline
            Write-Host "  applying $($script.Name)"
            Invoke-PsqlFile -DbName $MaintenanceDatabase -Path $temp.FullName
        }
    }
    finally {
        $tempFiles | ForEach-Object { Remove-Item $_.FullName -ErrorAction SilentlyContinue }
    }
}

# 3. Truncate the 29 domain tables (safe to repeat).
Write-Host "Truncating domain tables in '$Database'..."
Invoke-PsqlFile -DbName $MaintenanceDatabase -Path $truncateSql

Write-Host "Done. Target '$Database' is provisioned and empty; ready for MongoToPostgresMigrator." -ForegroundColor Green
