function Get-ExecutablePath {
    param([string[]]$Names)

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) { return $command.Source }
    }

    if ($IsLinux -and (Get-Command cmd.exe -ErrorAction SilentlyContinue) -and (Get-Command wslpath -ErrorAction SilentlyContinue)) {
        foreach ($name in $Names) {
            $whereName = if ($name.EndsWith(".exe")) { $name } else { "$name.exe" }
            $windowsPaths = @(& cmd.exe /c "where $whereName" 2>$null)
            if ($LASTEXITCODE -ne 0) { continue }

            foreach ($windowsPath in $windowsPaths) {
                $linuxPath = ((& wslpath -u $windowsPath 2>$null) | Out-String).Trim()
                if ($linuxPath -and (Test-Path $linuxPath)) { return $linuxPath }
            }
        }
    }

    return $null
}

function Test-K6Version {
    $k6 = Get-ExecutablePath @("k6", "k6.exe")
    if (-not $k6) { return $false }

    & $k6 version *>$null
    return $LASTEXITCODE -eq 0
}

function Get-K6VersionText {
    $k6 = Get-ExecutablePath @("k6", "k6.exe")
    if (-not $k6) { return "" }

    $version = (& $k6 version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) { return $version }

    return ""
}

function Invoke-WindowsK6Install {
    $installed = $false
    $winget = Get-ExecutablePath @("winget", "winget.exe")

    if ($winget) {
        Write-Info "Installing k6 via winget..."
        if ($PSCmdlet.ShouldProcess("Grafana k6", "winget install")) {
            & $winget install --id Grafana.k6 --silent --accept-source-agreements --accept-package-agreements
            if ($LASTEXITCODE -eq 0) {
                $installed = $true
            } else {
                Write-Warn "winget install Grafana.k6 exited $LASTEXITCODE; falling back to Chocolatey."
            }
        }
    } else {
        Write-Warn "winget is not on PATH; falling back to Chocolatey."
    }

    if (-not $installed) {
        $choco = Get-ExecutablePath @("choco", "choco.exe")
        if (-not $choco) {
            throw "k6 installation failed on Windows host: winget failed or was unavailable, and Chocolatey is not on PATH."
        }

        Write-Info "Installing k6 via Chocolatey..."
        if ($PSCmdlet.ShouldProcess("k6", "choco install")) {
            & $choco install k6 -y
            if ($LASTEXITCODE -ne 0) {
                throw "k6 installation failed on Windows host: choco install k6 exited $LASTEXITCODE."
            }
        }
    }
}

function Invoke-UbuntuK6Install {
    # v0.56 is the floor for the GLOBAL setInterval/setTimeout that
    # benchmark/k6-scripts/data-sync.js and smoke.js use unconditionally;
    # 0.57.0 is the newest release validated live against the cp09 suite.
    # (cp09/cp09-connections.js itself feature-detects the timer API and also
    # runs on older k6, e.g. 0.50 — see #113.)
    $preferredK6Version = "0.57.0"

    Write-Info "Adding the Grafana k6 apt repository..."
    if ($PSCmdlet.ShouldProcess("Grafana k6 apt repository", "configure")) {
        & sudo gpg -k
        if ($LASTEXITCODE -ne 0) {
            throw "k6 installation failed on Ubuntu host: sudo gpg -k exited $LASTEXITCODE."
        }

        & sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        if ($LASTEXITCODE -ne 0) {
            throw "k6 installation failed on Ubuntu host: failed to import the Grafana k6 apt key."
        }

        "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | & sudo tee /etc/apt/sources.list.d/k6.list | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "k6 installation failed on Ubuntu host: failed to write /etc/apt/sources.list.d/k6.list."
        }

        & sudo apt-get update
        if ($LASTEXITCODE -ne 0) {
            throw "k6 installation failed on Ubuntu host: sudo apt-get update exited $LASTEXITCODE."
        }

        Write-Info "Installing k6 $preferredK6Version..."
        & sudo apt-get install -y "k6=$preferredK6Version"
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "k6 $preferredK6Version was not available; installing the latest available k6 package."
            & sudo apt-get install -y k6
            if ($LASTEXITCODE -ne 0) {
                throw "k6 installation failed on Ubuntu host: sudo apt-get install k6 exited $LASTEXITCODE."
            }
        }
    }
}

function Invoke-InstallK6 {
    param(
        [Parameter(Mandatory)]
        [PSCustomObject]$State,

        [Parameter(Mandatory)]
        [ValidateSet("Windows", "Ubuntu")]
        [string]$HostPlatform
    )

    Write-Step "Phase 3b — Install k6 (optional cp09 prerequisite)"

    if (Test-K6Version) {
        Write-Info "k6 is already installed; skipping installation."
        Complete-Phase $State "install-k6"
        return
    }

    if ($HostPlatform -eq "Windows") {
        Invoke-WindowsK6Install
    } else {
        Invoke-UbuntuK6Install
    }

    if (-not (Test-K6Version)) {
        throw "k6 installation failed on $HostPlatform host: 'k6 version' did not succeed after installation."
    }

    $version = Get-K6VersionText
    if ($version) {
        Write-Success "k6 installed and verified: $version"
    } else {
        Write-Success "k6 installed and verified"
    }

    Complete-Phase $State "install-k6"
}
