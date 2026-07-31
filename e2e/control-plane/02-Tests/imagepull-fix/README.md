# Pester tests for the ImagePullBackOff permanent fix

This directory contains Pester v5 tests for the two PowerShell scripts that
implement the permanent ImagePullBackOff fix in the multi-cluster QA
environment.  `Trust-MinikubeCertificates.Tests.ps1` covers certificate
download, per-cluster CA installation, Docker daemon trust, dry-run preview,
error propagation, and missing-file edge cases.
`Assert-NoImagePullBackoff.Tests.ps1` covers healthy-cluster pass, pull-backoff
detection (regular and init containers), hard cluster-unreachable failure, and
eventual-recovery polling semantics.

## Usage

```powershell
Invoke-Pester -Path .\Trust-MinikubeCertificates.Tests.ps1, .\Assert-NoImagePullBackoff.Tests.ps1 -Output Detailed
```

## Requirements

Pester v5 or later is the only external dependency.  The tests run without a
real cluster: all `minikube` and `kubectl` calls are either Mocked by Pester
(Trust tests) or replaced by inline PowerShell functions in a child process
(Assert tests).  No `minikube`, `kubectl`, or network access is required.
