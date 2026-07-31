# FeatBit-Instrumented OpenTelemetry Demo

Deploys the [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo)
(the "Astronomy Shop" microservices app) with selected services rebuilt to evaluate
feature flags through FeatBit's native SDKs instead of the demo's built-in
`flagd`/OpenFeature provider. Used by the control-plane QA harness to generate
realistic multi-service flag-evaluation traffic during continuity/failover testing.

## Layout

| Path | Purpose |
|------|---------|
| `Build-OtelDemoImages.ps1` | Shallow-clones upstream at a pinned tag (default `2.2.0`) into `build/otel-demo-src/`, applies the `custom/` overlays, and builds `featbit-*` images. |
| `Deploy-OtelDemo.ps1` | Installs the demo via the upstream Helm chart with the FeatBit values overrides. |
| `Get-OtelImageArgs.ps1` | `Get-OtelImageArgs`, the pure function that renders per-component Helm `--set-string` image args; dot-sourced by `Deploy-OtelDemo.ps1` (and by tests, without a cluster). |
| `Provision-FeatBitFlags.py` | Creates the demo's feature flags in a FeatBit environment. |
| `custom/` | Per-service overlay files copied over the upstream source before building. |
| `values-featbit.yaml`, `values-min.yaml` | Helm values for the FeatBit-instrumented deployment. |
| `build/` | Working directory (gitignored). The upstream clone is fetched on demand; nothing here is committed. |

## Registry options

Component images built by `Build-OtelDemoImages.ps1` and deployed by
`Deploy-OtelDemo.ps1` are addressed as `<Registry>/<Repo>/<component>:featbit-<DemoVersion>`.
Both scripts default to the **local registry** and need no configuration out of
the box:

```powershell
pwsh ./Build-OtelDemoImages.ps1                       # -> localhost:5000/otel-demo/<component>:featbit-2.2.0
pwsh ./Deploy-OtelDemo.ps1 -FeatBitSecret $env:FEATBIT_ENV_SECRET
```

To use a private/team registry instead, pass matching `-Registry`/`-Repo` (and
`-DemoVersion` if you're not building `2.2.0`) to **both** scripts:

```powershell
pwsh ./Build-OtelDemoImages.ps1  -Registry harbor.tekgeek.io -Repo apps/otel-demo
pwsh ./Deploy-OtelDemo.ps1       -Registry harbor.tekgeek.io -Repo apps/otel-demo -FeatBitSecret ...
```

If that registry requires authentication, `Deploy-OtelDemo.ps1` creates a
`docker-registry` image pull secret in the `otel-demo` namespace (both
clusters) using the same `CUSTOM_REGISTRY_USERNAME` / `CUSTOM_REGISTRY_PASSWORD`
/ `CUSTOM_REGISTRY_SECRET_NAME` keys from `deployment.env` that
`Deploy-FeatBitClusters.ps1` uses for `CUSTOM_IMAGE_REGISTRY` (see
`../deployment.env.example`) — or pass `-CustomRegistryCredential` directly. No
secret is created when `-Registry` is the local registry (`localhost:5000` /
`127.0.0.1:*` / `host.minikube.internal:*`), since those pulls don't need auth.
Nothing under `values-featbit.yaml` hardcodes a registry — it only carries
non-image settings (FeatBit eval URLs); image references are always injected
at deploy time from `-Registry`/`-Repo`.

## Attribution and licensing

The files under `custom/` are **derived works of the OpenTelemetry Demo**
(© The OpenTelemetry Authors), which is licensed under the
[Apache License 2.0](./LICENSE) — a copy of that license is kept in this
directory. Per its terms:

- Each derived overlay file retains the upstream copyright/SPDX header
  (`Copyright The OpenTelemetry Authors` / `SPDX-License-Identifier: Apache-2.0`)
  and carries a prominent comment describing how it deviates from the upstream
  file it replaces.
- The overlays are based on upstream release **2.2.0** (the tag pinned in
  `Build-OtelDemoImages.ps1`; override with `-DemoVersion`).
- Upstream files without license headers (e.g. `*.csproj`) are reproduced
  without adding one, matching the source.

Any file under `custom/` bearing the OpenTelemetry header is Apache-2.0.
Files that are FeatBit-original rather than derived from upstream — the
PowerShell scripts, `Provision-FeatBitFlags.py`, the Helm values files, and
`featbit_client.py` — are covered by this repository's MIT license.

If you add a new overlay for another demo service, start from the upstream
file, keep its header, and add a comment block summarizing your changes.
