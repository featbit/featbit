#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Builds the Helm --set-string args that point each otel-demo component's
    image at a given registry/repo/tag.

.DESCRIPTION
    Split out of Deploy-OtelDemo.ps1 into its own dot-sourceable file (no
    side-effecting top-level code) so Get-OtelImageArgs can be exercised
    directly without running the rest of the deploy script (which needs a
    provision file and live cluster contexts). Dot-source this file and call
    Get-OtelImageArgs to verify the rendered args for any -Registry/-Repo/-Tag
    combination, e.g.:

        . ./Get-OtelImageArgs.ps1
        Get-OtelImageArgs -Components @("cart","frontend") `
            -Registry "harbor.tekgeek.io" -Repo "apps/otel-demo" -Tag "featbit-2.2.0"
#>

function Get-OtelImageArgs {
    param(
        [string[]]$Components,
        [string]$Registry,
        [string]$Repo,
        [string]$Tag
    )
    $imageArgs = @()
    foreach ($comp in $Components) {
        $imageArgs += @(
            "--set-string", "components.$comp.imageOverride.repository=$Registry/$Repo/$comp",
            "--set-string", "components.$comp.imageOverride.tag=$Tag",
            "--set-string", "components.$comp.imageOverride.pullPolicy=IfNotPresent"
        )
    }
    return $imageArgs
}
