# Control Plane QA

This directory contains the test infrastructure and test suites for validating FeatBit's control plane across multi-cluster (west/east) Minikube deployments.

## Directory Structure

| Folder | Purpose |
|--------|---------|
| [`00-Docs/`](00-Docs/) | Documentation — deployment guides, architecture reference, and testing plans |
| [`01-Infrastructure/`](01-Infrastructure/) | Scripts and configuration for deploying the test environment |
| [`02-Tests/`](02-Tests/) | Automated test scenarios, manual test procedures, and test applications |

## Quick Start

1. **Set up your environment** — copy and configure `01-Infrastructure/deployment.env.example` → `01-Infrastructure/deployment.env`
2. **Deploy clusters** — run the appropriate quickstart for your platform, or deploy manually:
   ```powershell
   cd 01-Infrastructure
   .\Deploy-FeatBitClusters.ps1
   .\Start-PortForwards.ps1
   .\Initialize-MongoDBReplicaSet.ps1
   ```
3. **Run tests** — see [02-Tests/](02-Tests/) for automated and manual test procedures

## Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](00-Docs/DEPLOYMENT.md) | Step-by-step deployment guide and script reference |
| [ARCHITECTURE.md](00-Docs/ARCHITECTURE.md) | MongoDB replica set topology, container registry setup, and multi-cluster testing strategy |
| [e2e-testing-plan.md](00-Docs/e2e-testing-plan.md) | End-to-end test plan with scenario cross-reference |
| [manual-testing-guide.md](00-Docs/manual-testing-guide.md) | Browser-based manual testing procedures |
| [deployment-testing.md](00-Docs/deployment-testing.md) | Testing documentation for upstream PR |

## 01-Infrastructure

Deployment scripts and platform-specific quickstart wizards:

- **`Deploy-FeatBitClusters.ps1`** — main deployment orchestrator (creates Minikube clusters, applies manifests)
- **`Initialize-LocalRegistry.ps1`** — builds FeatBit images and pushes to local Docker registry
- **`Start-PortForwards.ps1`** / **`Stop-PortForwards.ps1`** — manage kubectl port-forward processes
- **`Initialize-MongoDBReplicaSet.ps1`** — initialize cross-cluster MongoDB replica set
- **`Setup-FeatBitProxy.ps1`** — nginx reverse proxy with DNS-based access
- **Platform quickstarts**: `ubuntu/`, `windows-hyperv/`, `windows-wsl/` — resumable wizards per OS
- **`extras/`** — infrequently-used utilities (custom registry setup, Kafka repair, chaos mesh, diagnostics)

## 02-Tests

Test suites and test applications:

- **`automation-py/`** — Python-based automated test scenarios (cp01–cp08) using pytest + Poetry
- **`manual_scripts/`** — human-readable test procedures for browser-based verification
- **`Run-UATTests.ps1`** — UAT test pipeline orchestrator
- **`test-app/`** — .NET test application deployed to clusters for evaluation testing
- **`quick-test/`** — lightweight .NET test utility
- **`uat-k8s/`** — Kubernetes manifests for test app deployment and scaling
