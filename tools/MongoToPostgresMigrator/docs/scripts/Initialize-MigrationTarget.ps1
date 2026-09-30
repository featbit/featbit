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
      2. Applies the versioned schema init scripts in version order
         (infra/postgresql/docker-entrypoint-initdb.d, v0.0.0 -> latest), so the
         target always matches the current schema. Applied scripts are recorded
         in a bookkeeping table (featbit_migration_schema_history) in the target
         database, so re-running only applies what is still pending. The scripts
         are rewritten in memory to drop their hard-coded 'create database
         featbit' / '\connect featbit' lines, so -Database is always honoured.
      3. Truncates the 29 domain tables so the migrator's empty-target preflight
         passes.

    If the target database already contains a FeatBit schema that this script
    did not provision (e.g. it was created by the docker entrypoint), schema
    provisioning is skipped with a warning — re-applying the init scripts would
    fail on the existing relations. Pass -BaselineVersion to declare which
    schema version that database is already at; the scripts up to and including
    that version are then recorded as applied and only the later ones run.

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
    (default 'postgres'). All schema and truncate work runs against -Database.

.PARAMETER InitScriptsDir
    Location of the versioned init scripts. Defaults to the repo's
    infra/postgresql/docker-entrypoint-initdb.d relative to this script.

.PARAMETER BaselineVersion
    Schema version the target database is already at (e.g. '5.3.2'). Must match
    one of the init scripts in -InitScriptsDir. Only used when the database
    already has a FeatBit schema that this script did not provision: init scripts
    up to and including this version are recorded as applied without being
    executed, and the later ones are applied.

.PARAMETER TruncateOnly
    Skip schema provisioning; only truncate the domain tables.

.PARAMETER SkipDatabaseCreate
    Do not attempt CREATE DATABASE (use when the managed instance's database is
    pre-provisioned and your user cannot create databases).

.EXAMPLE
    $env:PGPASSWORD = '...'
    .\Initialize-MigrationTarget.ps1 -PgHost pg.dev.example.com -Username featbit_admin

.EXAMPLE
    # bring an existing v5.3.2 database up to the latest schema
    .\Initialize-MigrationTarget.ps1 -PgHost pg.dev.example.com -Username featbit_admin `
        -Database featbit_migration -BaselineVersion 5.3.2

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
    [string]$BaselineVersion,
    [switch]$TruncateOnly,
    [switch]$SkipDatabaseCreate
)

$ErrorActionPreference = 'Stop'

$HistoryTable = 'featbit_migration_schema_history'
# Any table from the v0.0.0 baseline; its presence means the database already
# carries a FeatBit schema.
$SchemaProbeTable = 'feature_flags'

# UTF-8 without a BOM, used for every init-script read/write so the round-trip is
# byte-faithful on Windows PowerShell 5.1 (whose default is the ANSI code page).
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Ensure psql interprets those bytes as UTF-8 regardless of the console code page.
$env:PGCLIENTENCODING = 'UTF8'

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "The 'psql' client was not found on PATH. Install the PostgreSQL client tools and retry."
}

if ($Password) { $env:PGPASSWORD = $Password }
if (-not $env:PGPASSWORD) {
    throw "Provide -Password or set the PGPASSWORD environment variable."
}

function Invoke-PsqlFile {
    param(
        [Parameter(Mandatory)][string]$DbName,
        [Parameter(Mandatory)][string]$Path,
        [switch]$SingleTransaction
    )
    $psqlArgs = @('-v', 'ON_ERROR_STOP=1', '--no-psqlrc')
    if ($SingleTransaction) { $psqlArgs += '--single-transaction' }
    $psqlArgs += @('-h', $PgHost, '-p', $Port, '-U', $Username, '-d', $DbName, '-f', $Path)
    & psql @psqlArgs
    if ($LASTEXITCODE -ne 0) { throw "psql failed running '$Path' (exit $LASTEXITCODE)." }
}

function Invoke-PsqlScalar {
    param([Parameter(Mandatory)][string]$DbName, [Parameter(Mandatory)][string]$Sql)
    $out = & psql -v ON_ERROR_STOP=1 --no-psqlrc -tAq -h $PgHost -p $Port -U $Username -d $DbName -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql query failed (exit $LASTEXITCODE)." }
    return ($out | Select-Object -First 1)
}

function Invoke-PsqlCommand {
    param([Parameter(Mandatory)][string]$DbName, [Parameter(Mandatory)][string]$Sql)
    & psql -v ON_ERROR_STOP=1 --no-psqlrc -tAq -h $PgHost -p $Port -U $Username -d $DbName -c $Sql | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "psql command failed (exit $LASTEXITCODE)." }
}

function Get-ScriptVersion {
    param([Parameter(Mandatory)][System.IO.FileInfo]$File)
    return [version]($File.BaseName.TrimStart('v', 'V'))
}

if ($Database -notmatch '^[A-Za-z_][A-Za-z0-9_$]*$') {
    throw "Invalid -Database name '$Database'. Use letters, digits, '_' and '`$', starting with a letter or '_'."
}

if ($BaselineVersion) {
    try { $baseline = [version]$BaselineVersion.TrimStart('v', 'V') }
    catch { throw "Invalid -BaselineVersion '$BaselineVersion'. Use a version such as '5.3.2'." }
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
            Invoke-PsqlCommand -DbName $MaintenanceDatabase -Sql "CREATE DATABASE ""$Database"";"
        }
        else {
            Write-Host "Database '$Database' already exists; skipping CREATE DATABASE."
        }
    }

    $scripts = @(Get-ChildItem -Path $resolvedDir -Filter '*.sql' |
        Sort-Object { Get-ScriptVersion -File $_ })

    if (-not $scripts) { throw "No .sql init scripts found in $resolvedDir." }

    if ($BaselineVersion) {
        # A baseline must name a real init script. A syntactically valid but
        # unknown version (e.g. '53.2.0') would otherwise mark every script as
        # applied and skip provisioning entirely, leaving the schema stale.
        $scriptVersions = @($scripts | ForEach-Object { Get-ScriptVersion -File $_ })
        if ($scriptVersions -notcontains $baseline) {
            throw ("-BaselineVersion '$BaselineVersion' does not match any init script in $resolvedDir. " +
                "Known versions: $(($scripts | ForEach-Object { $_.BaseName }) -join ', ').")
        }
    }

    # 2. Work out which scripts still need to run. Every connection below targets
    #    -Database directly; the scripts' hard-coded \connect is stripped so the
    #    requested database is never silently swapped for 'featbit'.
    $historyExists = (Invoke-PsqlScalar -DbName $Database `
            -Sql "SELECT to_regclass('public.$HistoryTable') IS NOT NULL;") -eq 't'
    $schemaExists = (Invoke-PsqlScalar -DbName $Database `
            -Sql "SELECT to_regclass('public.$SchemaProbeTable') IS NOT NULL;") -eq 't'

    $provision = $true

    if (-not $historyExists) {
        if ($schemaExists -and -not $BaselineVersion) {
            # Re-running the unconditional CREATE TABLEs would abort on the first
            # existing relation, so leave the schema alone.
            Write-Warning ("Database '$Database' already contains a FeatBit schema that this script did not " +
                "provision. Skipping schema provisioning - verify it matches $($scripts[-1].BaseName), or " +
                're-run with -BaselineVersion <version> to apply only the later init scripts.')
            $provision = $false
        }
        else {
            # Create the history table and seed the baseline rows in ONE
            # transaction (psql runs a multi-statement -c string as a single
            # transaction). A partially-seeded history would look complete on the
            # next run, which would then re-apply unrecorded baseline scripts as
            # unconditional DDL against relations that already exist.
            $seedSql = @"
CREATE TABLE IF NOT EXISTS $HistoryTable (
    script_name text PRIMARY KEY,
    version     text        NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
);
"@
            $seeded = @()
            if ($schemaExists) {
                $seeded = @($scripts | Where-Object { (Get-ScriptVersion -File $_) -le $baseline })
                foreach ($script in $seeded) {
                    $version = (Get-ScriptVersion -File $script).ToString()
                    $seedSql += "`nINSERT INTO $HistoryTable (script_name, version) VALUES " +
                    "('$($script.Name)', '$version') ON CONFLICT DO NOTHING;"
                }
            }

            Invoke-PsqlCommand -DbName $Database -Sql $seedSql

            if ($seeded) {
                Write-Host "Baselined $($seeded.Count) script(s) at or below v$baseline as already applied."
            }
        }
    }

    if ($provision) {
        $applied = @(& psql -v ON_ERROR_STOP=1 --no-psqlrc -tAq -h $PgHost -p $Port -U $Username `
                -d $Database -c "SELECT script_name FROM $HistoryTable;")
        if ($LASTEXITCODE -ne 0) { throw "psql failed reading $HistoryTable (exit $LASTEXITCODE)." }

        $pending = @($scripts | Where-Object { $applied -notcontains $_.Name })
        if (-not $pending) {
            Write-Host "Schema is already up to date; no init scripts pending."
        }

        # 3. Apply each pending script. 'create database ...' and '\connect ...'
        #    are stripped so the file runs against -Database, and the history row
        #    is written in the same transaction as the DDL.
        $tempFiles = @()
        try {
            foreach ($script in $pending) {
                $version = (Get-ScriptVersion -File $script).ToString()
                # Explicit UTF-8 both ways: Windows PowerShell 5.1 would otherwise
                # read and write these with the system ANSI code page, corrupting
                # any non-ASCII literal in an init script. Written without a BOM,
                # which psql does not strip.
                $content = [System.IO.File]::ReadAllText($script.FullName, $Utf8NoBom)
                $content = $content -replace '(?im)^\s*create\s+database\s+\w+\s*;', ''
                $content = $content -replace '(?im)^[^\S\r\n]*\\connect\b[^\r\n]*', ''
                $content += "`nINSERT INTO $HistoryTable (script_name, version) VALUES ('$($script.Name)', '$version');`n"
                $temp = New-TemporaryFile
                $tempFiles += $temp
                [System.IO.File]::WriteAllText($temp.FullName, $content, $Utf8NoBom)
                Write-Host "  applying $($script.Name)"
                Invoke-PsqlFile -DbName $Database -Path $temp.FullName -SingleTransaction
            }
        }
        finally {
            $tempFiles | ForEach-Object { Remove-Item $_.FullName -ErrorAction SilentlyContinue }
        }
    }
}

# 4. Truncate the 29 domain tables (safe to repeat).
Write-Host "Truncating domain tables in '$Database'..."
Invoke-PsqlFile -DbName $Database -Path $truncateSql -SingleTransaction

Write-Host "Done. Target '$Database' is provisioned and empty; ready for MongoToPostgresMigrator." -ForegroundColor Green
