# Tools

Small local utilities for development and manual testing. Run commands from the repository root:

```powershell
cd C:\Code\featbit\featbit
```

## seed-release-decision-insights.cs

Seeds FeatBit insight events through the real evaluation path:

1. Generate stable synthetic user `keyId` values.
2. Call the evaluation server for each user.
3. Let the live FeatBit targeting and rollout decide the variation split.
4. Emit metric events with the same user key.

The tool does not accept manual split arguments such as `--variant`, `--variation-id`, `--send-mode`, `--start-date`, or `--end-date`. Events use current timestamps.

When the backend uses `FeatureFlagInsights:Provider=featbit-api`, release-decision exposure and metric evidence is written into the dedicated tables. The tool does not send experiment or run ids; the backend attributes events to the active collecting run for the evaluated flag, user, metric event, and observation window.

Common options:

- `--env-secret`: required server SDK secret for the target environment.
- `--evaluation-url`: evaluation server base URL, default `http://localhost:5100`.
- `--flag-key`: feature flag key, default `pricing-self-host-value-prop`.
- `--users`: total generated users, default `3000`.
- `--seed`: deterministic seed for generated user keys.
- `--batch-size`: track request batch size, default `5`.
- `--dry-run`: evaluate and print planned counts without sending any insight events.

Backend insight storage follows `FeatureFlagInsights:Provider`:

- `featbit-api`: write and analyze release-decision evidence tables.
- `featbit-das`: write and analyze legacy `events` / `Events`.

Metric format:

```text
--metric <event>:<binary|continuous>:<once|count|sum|average>:<variation=target,...>
--guardrail <event>:<binary|continuous>:<once|count|sum|average>:<variation=target,...>
```

Variation target keys can be either the real variation string value or the real variation id returned by evaluation.

### Case 1: Binary Once

Use this for conversion-style metrics such as CTA click once per visitor. Target `0.06` means 6% of experiment users actually evaluated into that variation emit the metric.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --evaluation-url http://localhost:5100 `
  --flag-key pricing-self-host-value-prop `
  --users 3000 `
  --metric self_host_high_intent_cta_clicked:binary:once:control=0.04,cost_savings=0.055,security_private=0.05,compliance=0.047,high_mau=0.06,quick_judgment=0.052
```

### Case 2: Continuous Count

Use this when the metric is a total number of events for users in each evaluated variation.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --users 3000 `
  --metric pricing_cta_hovered:continuous:count:control=180,cost_savings=230,security_private=210,compliance=205,high_mau=260,quick_judgment=225
```

### Case 3: Continuous Sum

Use this when the metric is a total numeric amount for each evaluated variation.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --users 3000 `
  --metric self_host_pipeline_value:continuous:sum:control=12000,cost_savings=15800,security_private=14250,compliance=13600,high_mau=17100,quick_judgment=14950
```

### Case 4: Continuous Average

Use this when each emitted event carries a per-user numeric value.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --users 3000 `
  --metric pricing_page_engaged_seconds:continuous:average:control=18,cost_savings=24,security_private=22,compliance=21,high_mau=27,quick_judgment=23
```

### Case 5: Primary Metric Plus Guardrail

Guardrails use the same format as primary metrics.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key pricing-self-host-value-prop `
  --users 3000 `
  --metric self_host_high_intent_cta_clicked:binary:once:control=0.04,cost_savings=0.055,security_private=0.05,compliance=0.047,high_mau=0.06,quick_judgment=0.052 `
  --guardrail pricing_page_error:binary:once:control=0.006,cost_savings=0.007,security_private=0.006,compliance=0.008,high_mau=0.007,quick_judgment=0.006
```

### Help

```powershell
dotnet run tools\seed-release-decision-insights.cs -- --help
```
