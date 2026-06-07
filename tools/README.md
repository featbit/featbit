# Tools

This folder contains small local utilities for development and manual testing.
Run commands from the repository root:

```powershell
cd C:\Code\featbit\featbit
```

## seed-release-decision-insights.cs

Seeds FeatBit insight events through the evaluation server so release-decision analysis can read realistic experiment data from the normal `events` pipeline.

Use this when you want `Analyze Latest Data` or the native FeatBit flag Insights page to see matching:

- feature flag exposure events
- primary metric events
- guardrail metric events
- `FlagValue` variation ids that match the real FeatBit feature flag variation ids
- event timestamps inside the observation window

Important: `--variant` is a readable alias used by this tool for populations and metric targets. It is not the release-decision run arm. Native FeatBit Insights reads the real variation id stored in `FlagValue`, so pass `--variation-id` when seeding data for an existing flag.

Release-decision analysis also groups exposure data by the generated `FlagValue` variation id. A run's control/treatment variants must resolve to the same real FeatBit variation ids. If the selected flag has variations named `Control` and `Treatment`, the API aligns the run to those ids before analysis. Otherwise configure the run arms with real variation ids through the UI/MCP.

### Dry Run

Use `--dry-run` first to verify the generated counts without posting data:

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --dry-run `
  --env-id a30da40d-1f8a-4f4f-86a8-323ac65326d6 `
  --flag-key rtr002 `
  --variant True=1200 `
  --variation-id True=40564793-25cf-417d-9399-989073e84da6 `
  --variation-value True=true `
  --variant False=1180 `
  --variation-id False=267b459b-de61-49fb-bdfc-7d6a211d4da4 `
  --variation-value False=false `
  --metric self_hosted_feature_flags_engaged_time:continuous:average:True=12,False=26 `
  --guardrail self_hosted_feature_flags_render_error:binary:once:True=36,False=37 `
  --guardrail self_hosted_feature_flags_decision_path_link_error:binary:once:True=4,False=5 `
  --start-date 2026-06-01 `
  --end-date 2026-06-06
```

### Seed Current Aspire Data

`--env-secret` must be the server SDK secret for the target FeatBit environment. The `--env-id` value is kept in the command for readability, but ingestion is authorized by `--env-secret`.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --env-id a30da40d-1f8a-4f4f-86a8-323ac65326d6 `
  --flag-key rtr002 `
  --variant True=1200 `
  --variation-id True=40564793-25cf-417d-9399-989073e84da6 `
  --variation-value True=true `
  --variant False=1180 `
  --variation-id False=267b459b-de61-49fb-bdfc-7d6a211d4da4 `
  --variation-value False=false `
  --metric self_hosted_feature_flags_engaged_time:continuous:average:True=12,False=26 `
  --guardrail self_hosted_feature_flags_render_error:binary:once:True=36,False=37 `
  --guardrail self_hosted_feature_flags_decision_path_link_error:binary:once:True=4,False=5 `
  --start-date 2026-06-01 `
  --end-date 2026-06-06
```

### Parameters

`--evaluation-url`

Evaluation server base URL. Defaults to `http://localhost:5100`.

`--env-secret`

Required unless `--dry-run` is set. This is the server SDK secret used by `/api/public/insight/track`.

`--env-id`

Optional label printed in the summary. The actual environment is determined by `--env-secret`.

`--flag-key`

Feature flag key. Must match the flag selected by the release-decision run.

`--variant <name=count>`

Adds one variant population. Repeat once per variation alias. Metric target specs use these aliases, so keep them short and readable.

Example:

```powershell
--variant True=1200 --variant False=1180
```

`--variation-id <variant-name=actual-variation-id>`

Maps a readable `--variant` alias to the real FeatBit feature flag variation id written into `FlagValue` insight events. This is required when you want the native FeatBit flag Insights page to show non-zero Control/Treatment counts.

When `--variation-id` is present, the generated exposure data uses that id as the canonical variant key.

For example, if a boolean flag stores `true` and `false` as real variation ids, use readable aliases for the populations and map each alias to the real id:

```powershell
--variant True=1200 `
--variation-id True=40564793-25cf-417d-9399-989073e84da6 `
--variant False=1180 `
--variation-id False=267b459b-de61-49fb-bdfc-7d6a211d4da4
```

`--variation-value <variant-name=actual-value>` is optional. If omitted, the readable variant name is also used as the insight variation value.

For boolean flags, prefer passing both `--variation-id` and `--variation-value`. Example for `rtr002`:

```powershell
--variant True=1200 `
--variation-id True=40564793-25cf-417d-9399-989073e84da6 `
--variation-value True=true `
--variant False=1180 `
--variation-id False=267b459b-de61-49fb-bdfc-7d6a211d4da4 `
--variation-value False=false
```

`--metric <event:type:agg:targets>`

Adds a primary metric event plan.

Format:

```text
event:binary|continuous:once|count|sum|average:VariantA=target,VariantB=target
```

Examples:

```powershell
--metric mn1:binary:once:True=132,False=165
--metric revenue:continuous:sum:True=52000,False=61000
--metric clicks:continuous:count:True=900,False=1100
--metric order_value:continuous:average:True=42.5,False=47.2
```

`--guardrail <event:type:agg:targets>`

Adds a guardrail metric event plan. It uses the same format as `--metric`.

Example:

```powershell
--guardrail afa:binary:once:True=36,False=41
```

`--start-date` / `--end-date`

Inclusive observation window dates in `yyyy-MM-dd` format. Generated exposure and metric events are placed inside this window.

`--batch-size`

HTTP batch size for posting insights. Defaults to `50`.

`--seed`

Deterministic seed value used in generated user keys. Defaults to `20260604`.

`--user-prefix`

Prefix for generated user keys. Defaults to `rd-seed`.

### Target Semantics

For `binary` or `once`, target values behave like this:

- `0 <= target <= 1`: conversion rate
- `target > 1`: converted user count

For continuous metrics:

- `count`: target is total event count for the variant
- `sum`: target is total numeric sum for the variant
- `average`: target is each user's numeric value

### Backward-Compatible Mode

The old control/treatment arguments still work:

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --flag-key abtest-trial001 `
  --metric-event signup `
  --control-variant v1 `
  --treatment-variant v2 `
  --users-per-variant 120 `
  --control-rate 0.20 `
  --treatment-rate 0.36 `
  --start-date 2026-06-01 `
  --end-date 2026-06-02
```

### Help

```powershell
dotnet run tools\seed-release-decision-insights.cs -- --help
```
