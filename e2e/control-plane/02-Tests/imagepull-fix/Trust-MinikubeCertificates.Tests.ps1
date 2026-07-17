#Requires -Module Pester
<#
.SYNOPSIS
    Pester v5 tests for Trust-MinikubeCertificates.ps1.

.NOTES
    Strategy
    --------
    The script under test uses 'return' (not 'exit'), so it is safe to
    dot-source it inside each It block.  Dot-sourcing runs the script body in
    the current scope, which means Pester's Mock mechanism can intercept both
    Invoke-WebRequest and the 'minikube' external command.

    The minikube mock sets $global:LASTEXITCODE = 0 so the script's
    LASTEXITCODE guards do not throw.  Tests that want the docker-daemon poll
    loop exercised must also mock the 'docker info' probe to return "OK".

    Fixtures
    --------
    deployment.env files are created in Pester's $TestDrive (a per-scope
    ephemeral directory) so tests are fully isolated and leave no artefacts.

    Compatibility: Pester v5, PowerShell 5.1 and 7+.
    Requirements : Pester installed; no minikube binary or real clusters needed.
#>

# ── Shared setup ─────────────────────────────────────────────────────────────

BeforeAll {
    $script:SutPath = Resolve-Path (
        Join-Path $PSScriptRoot "..\..\01-Infrastructure\Trust-MinikubeCertificates.ps1"
    ) | Select-Object -ExpandProperty Path
}

# ─────────────────────────────────────────────────────────────────────────────
# A  Default invocation
# ─────────────────────────────────────────────────────────────────────────────

Describe "Trust-MinikubeCertificates - default invocation" {

    # ── A-1: empty TRUST_CERTIFICATES, no RegistryHosts ──────────────────────

    Context "with empty TRUST_CERTIFICATES and no RegistryHosts" {

        BeforeAll {
            $envFile = Join-Path $TestDrive "deployment.env"
            Set-Content -Path $envFile -Value "CUSTOM_IMAGE_REGISTRY="

            Mock Invoke-WebRequest { }
            Mock minikube { $global:LASTEXITCODE = 0 }
        }

        It "returns without throwing" {
            { . $script:SutPath -DeploymentEnvFile $envFile } | Should -Not -Throw
        }

        It "does not call Invoke-WebRequest" {
            . $script:SutPath -DeploymentEnvFile $envFile
            Should -Invoke Invoke-WebRequest -Times 0 -Exactly
        }

        It "does not call minikube" {
            . $script:SutPath -DeploymentEnvFile $envFile
            Should -Invoke minikube -Times 0 -Exactly
        }
    }

    # ── A-2: empty TRUST_CERTIFICATES but RegistryHosts supplied ─────────────

    Context "with no cert sources but RegistryHosts explicitly supplied" {

        BeforeAll {
            $envFile = Join-Path $TestDrive "deployment.env"
            Set-Content -Path $envFile -Value "CUSTOM_IMAGE_REGISTRY="
        }

        It "throws with a message matching *No certificate sources configured but -RegistryHosts*" {
            {
                . $script:SutPath `
                    -DeploymentEnvFile $envFile `
                    -RegistryHosts @("myregistry.example.com")
            } | Should -Throw "*No certificate sources configured but -RegistryHosts*"
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# B  Single host config
# ─────────────────────────────────────────────────────────────────────────────

Describe "Trust-MinikubeCertificates - single host config" {

    BeforeAll {
        # One cert entry; CUSTOM_IMAGE_REGISTRY used as default registry host.
        $envFile = Join-Path $TestDrive "deployment.env"
        @"
CUSTOM_IMAGE_REGISTRY=myregistry.example.com
TRUST_CERTIFICATES=myca|https://certs.example.com/ca.crt|/usr/local/share/ca-certificates/myca.crt
"@ | Set-Content -Path $envFile
    }

    # ── B-1: DryRun defaults RegistryHosts to CUSTOM_IMAGE_REGISTRY ──────────

    Context "with one TRUST_CERTIFICATES entry and CUSTOM_IMAGE_REGISTRY in env, no -RegistryHosts flag" {

        BeforeAll {
            Mock Invoke-WebRequest { }
            Mock minikube { $global:LASTEXITCODE = 0 }
        }

        It "does not throw in dry-run mode" {
            {
                . $script:SutPath `
                    -DeploymentEnvFile $envFile `
                    -DryRun `
                    -Clusters @("west-test")
            } | Should -Not -Throw
        }

        It "does not call Invoke-WebRequest during dry-run" {
            . $script:SutPath -DeploymentEnvFile $envFile -DryRun -Clusters @("west-test")
            Should -Invoke Invoke-WebRequest -Times 0 -Exactly
        }

        It "does not call minikube during dry-run" {
            . $script:SutPath -DeploymentEnvFile $envFile -DryRun -Clusters @("west-test")
            Should -Invoke minikube -Times 0 -Exactly
        }

        It "includes CUSTOM_IMAGE_REGISTRY host in dry-run output" {
            # The script prints the registry host via Write-Host (stream 6).
            # -InformationVariable captures stream-6 records; the script has
            # [CmdletBinding()] so the common parameter is accepted.
            . $script:SutPath `
                -DeploymentEnvFile $envFile `
                -DryRun `
                -Clusters @("west-test") `
                -InformationVariable dryOut
            ($dryOut.MessageData -join "`n") | Should -Match 'myregistry\.example\.com'
        }
    }

    # ── B-2: explicit -RegistryHosts override wins over CUSTOM_IMAGE_REGISTRY ─

    Context "with -RegistryHosts override" {

        BeforeAll {
            Mock Invoke-WebRequest { }
            Mock minikube { $global:LASTEXITCODE = 0 }
        }

        It "uses the explicit override host instead of CUSTOM_IMAGE_REGISTRY in dry-run output" {
            . $script:SutPath `
                -DeploymentEnvFile $envFile `
                -DryRun `
                -Clusters @("west-test") `
                -RegistryHosts @("override.example.com") `
                -InformationVariable dryOut
            ($dryOut.MessageData -join "`n") | Should -Match 'override\.example\.com'
        }

        It "does not include CUSTOM_IMAGE_REGISTRY when -RegistryHosts is supplied" {
            . $script:SutPath `
                -DeploymentEnvFile $envFile `
                -DryRun `
                -Clusters @("west-test") `
                -RegistryHosts @("override.example.com") `
                -InformationVariable dryOut
            # The defaulting branch is skipped when -RegistryHosts is bound,
            # so "myregistry.example.com" must not appear in the Docker-trust block.
            ($dryOut.MessageData -join "`n") | Should -Not -Match '/etc/docker/certs\.d/myregistry\.example\.com'
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# C  Multi-host config  (2 clusters × 3 certs, no Docker daemon trust)
# ─────────────────────────────────────────────────────────────────────────────

Describe "Trust-MinikubeCertificates - multi-host config" {

    BeforeAll {
        # Three semicolon-separated certs.  CUSTOM_IMAGE_REGISTRY is empty so
        # Docker-daemon trust is skipped when -RegistryHosts @() is passed;
        # this avoids the daemon-restart/poll loop in the mock environment.
        $envFile = Join-Path $TestDrive "deployment.env"
        @"
CUSTOM_IMAGE_REGISTRY=
TRUST_CERTIFICATES=cert1|https://certs.example.com/cert1.crt|/usr/local/share/ca-certificates/cert1.crt;cert2|https://certs.example.com/cert2.crt|/usr/local/share/ca-certificates/cert2.crt;cert3|https://certs.example.com/cert3.crt|/usr/local/share/ca-certificates/cert3.crt
"@ | Set-Content -Path $envFile
    }

    Context "with multiple TRUST_CERTIFICATES entries (semicolon-separated)" {

        BeforeAll {
            Mock Invoke-WebRequest { }
            Mock minikube { $global:LASTEXITCODE = 0 }
        }

        # 3 certificates → 3 Invoke-WebRequest downloads.
        It "downloads each certificate exactly once (3 Invoke-WebRequest calls)" {
            . $script:SutPath -DeploymentEnvFile $envFile -Clusters @("a", "b") -RegistryHosts @()
            Should -Invoke Invoke-WebRequest -Times 3 -Exactly
        }

        # minikube call accounting for 2 clusters, 3 certs, 0 registry hosts:
        #   minikube -p <c> cp   (copy local → remote temp) : 3 certs × 2 clusters = 6
        #   minikube ssh -p <c> -- <install mv+chmod>       : 3 certs × 2 clusters = 6
        #   minikube ssh -p <c> -- update-ca-certificates   : 1        × 2 clusters = 2
        #                                                    ────────────────────────
        #   Total                                                                    14
        It "calls minikube the correct total number of times (14)" {
            . $script:SutPath -DeploymentEnvFile $envFile -Clusters @("a", "b") -RegistryHosts @()
            Should -Invoke minikube -Times 14 -Exactly
        }

        # The 'cp' verb is $args[2] in: minikube -p <cluster> cp <src> <dst>
        It "issues exactly 6 minikube cp calls (one per cert per cluster)" {
            . $script:SutPath -DeploymentEnvFile $envFile -Clusters @("a", "b") -RegistryHosts @()
            Should -Invoke minikube -ParameterFilter { $args[2] -eq 'cp' } -Times 6 -Exactly
        }

        # 'ssh' is $args[0] in: minikube ssh -p <cluster> -- <cmd>
        # 3 install calls + 1 update-ca call = 4 per cluster, 8 total
        It "issues exactly 8 minikube ssh calls (install + CA-update per cluster)" {
            . $script:SutPath -DeploymentEnvFile $envFile -Clusters @("a", "b") -RegistryHosts @()
            Should -Invoke minikube -ParameterFilter { $args[0] -eq 'ssh' } -Times 8 -Exactly
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# D  Missing env file
# ─────────────────────────────────────────────────────────────────────────────

Describe "Trust-MinikubeCertificates - missing env file" {

    BeforeAll {
        Mock Invoke-WebRequest { }
        Mock minikube { $global:LASTEXITCODE = 0 }
    }

    Context "with no deployment.env at any search path" {

        It "returns without throwing when -DeploymentEnvFile points to a nonexistent path" {
            # Get-DeploymentEnvValue returns '' for a missing file, so both
            # TRUST_CERTIFICATES and CUSTOM_IMAGE_REGISTRY are empty.
            # The script hits the 'nothing to do' branch and returns cleanly.
            $noSuchFile = Join-Path $TestDrive "nonexistent\deployment.env"
            { . $script:SutPath -DeploymentEnvFile $noSuchFile } | Should -Not -Throw
        }

        It "does not call Invoke-WebRequest when env file is absent" {
            $noSuchFile = Join-Path $TestDrive "nonexistent\deployment.env"
            . $script:SutPath -DeploymentEnvFile $noSuchFile
            Should -Invoke Invoke-WebRequest -Times 0 -Exactly
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# E  Bad cert URL
# ─────────────────────────────────────────────────────────────────────────────

Describe "Trust-MinikubeCertificates - bad cert URL" {

    BeforeAll {
        $envFile = Join-Path $TestDrive "deployment.env"
        @"
CUSTOM_IMAGE_REGISTRY=
TRUST_CERTIFICATES=badcert|https://certs.example.com/missing.crt|/usr/local/share/ca-certificates/badcert.crt
"@ | Set-Content -Path $envFile

        # Simulate a network failure for every certificate download.
        Mock Invoke-WebRequest { throw "Could not connect to host certs.example.com" }
        Mock minikube { $global:LASTEXITCODE = 0 }
    }

    Context "when Invoke-WebRequest throws for a configured cert" {

        It "rethrows with a message that references the certificate URL" {
            # The script wraps the failure:
            #   "Certificate download failed for '...' (URL: <url>): <inner error>"
            {
                . $script:SutPath `
                    -DeploymentEnvFile $envFile `
                    -Clusters @("west-test")
            } | Should -Throw "*https://certs.example.com/missing.crt*"
        }
    }
}
