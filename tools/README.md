# Tools

Small local utilities for development and manual testing. Run commands from the repository root:

```powershell
cd C:\Code\featbit\featbit
```

## seed-release-decision-insights.cs

Seeds FeatBit insight events through the FeatBit .NET Server SDK:

1. Generate stable synthetic user `keyId` values.
2. Initialize `FeatBit.ServerSdk` against the target evaluation/event server.
3. Evaluate the configured flag for each user with SDK variation detail.
4. Let the live FeatBit targeting and rollout decide the variation split.
5. Emit metric events with SDK `Track` and the same user key.

The tool does not accept manual split arguments such as `--variant`, `--variation-id`, `--send-mode`, `--start-date`, or `--end-date`. Events use current timestamps.

When the backend uses `FeatureFlagInsights:Provider=featbit-api`, release-decision exposure and metric evidence is written into the dedicated tables. The tool does not send experiment or run ids; the backend attributes events to the active collecting run for the evaluated flag, user, metric event, and observation window.

Common options:

- `--env-secret`: required server SDK secret for the target environment.
- `--event-url`: evaluation/event server base URL, default `http://localhost:5100`.
- `--streaming-url`: SDK streaming URL, default derived from `--event-url` by converting `http/https` to `ws/wss`.
- `--evaluation-url`: legacy alias for `--event-url`.
- `--flag-key`: feature flag key, default `pricing-self-host-value-prop`.
- `--flag-type`: SDK variation detail type, default `bool`; supports `bool`, `string`, `int`, `double`, `float`.
- `--users`: total generated users, default `3000`.
- `--seed`: deterministic seed for generated user keys.
- `--batch-size`: SDK max events per request, default `100`.
- `--dry-run`: evaluate and print planned counts with SDK event collection disabled.

Backend insight storage follows `FeatureFlagInsights:Provider`:

- `featbit-api`: write and analyze release-decision evidence tables.
- `featbit-das`: write and analyze legacy `events` / `Events`.

Metric format:

```text
--metric <event>:<binary|continuous>:<once|count|sum|average>:<variation=target,...>
--guardrail <event>:<binary|continuous>:<once|count|sum|average>:<variation=target,...>
```

Variation target keys can be either the real variation value or the real variation id returned by SDK variation detail. Boolean variation values are matched as lower-case `true` / `false`.

### Case 1: Binary Once

Use this for conversion-style metrics such as CTA click once per visitor. Target `0.06` means 6% of experiment users actually evaluated into that variation emit the metric.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --event-url http://localhost:5100 `
  --streaming-url ws://localhost:5100 `
  --flag-key pricing-self-host-value-prop `
  --flag-type bool `
  --users 3000 `
  --metric self_host_high_intent_cta_clicked:binary:once:true=0.04,false=0.055
```

### Case 2: Continuous Count

Use this when the metric is a total number of events for users in each evaluated variation.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --flag-type bool `
  --users 3000 `
  --metric pricing_cta_hovered:continuous:count:true=180,false=230
```

### Case 3: Continuous Sum

Use this when the metric is a total numeric amount for each evaluated variation.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --flag-type bool `
  --users 3000 `
  --metric self_host_pipeline_value:continuous:sum:true=12000,false=15800
```

### Case 4: Continuous Average

Use this when each emitted event carries a per-user numeric value.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --flag-type bool `
  --users 3000 `
  --metric pricing_page_engaged_seconds:continuous:average:true=18,false=24
```

### Case 5: Primary Metric Plus Guardrail

Guardrails use the same format as primary metrics.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --flag-type bool `
  --users 3000 `
  --metric self_host_high_intent_cta_clicked:binary:once:true=0.04,false=0.055 `
  --guardrail pricing_page_error:binary:once:true=0.006,false=0.007
```

### Help

```powershell
dotnet run tools\seed-release-decision-insights.cs -- --help
```
