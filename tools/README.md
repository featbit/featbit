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

Important: `--variant` is a readable alias used by this tool for populations and metric targets. For string flags, use the actual string variation value as the alias when it is short and shell-safe. Native FeatBit Insights reads the real variation id stored in `FlagValue`, so pass `--variation-id` when seeding data for an existing flag.

Release-decision analysis also groups exposure data by the generated `FlagValue` variation id. The run's selected variants must resolve to the same real FeatBit variation ids used by `--variation-id`.

The tool supports two send modes:

- `--send-mode direct` posts generated insight payloads to `/api/public/insight/track`. This is the default and is required when you need event timestamps spread across a historical observation window.
- `--send-mode sdk` uses `FeatBit.ServerSdk`: it evaluates the configured flag for each generated user and then calls `Track` for each metric event. The SDK uses live event timestamps, so the observation window must include today.

### Dry Run

Use `--dry-run` first to verify the generated counts without posting data:

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --dry-run `
  --env-id a30da40d-1f8a-4f4f-86a8-323ac65326d6 `
  --flag-key <flag-key> `
  --variant <string-value-1>=1200 `
  --variation-id <string-value-1>=<variation-id-1> `
  --variation-value <string-value-1>=<string-value-1> `
  --variant <string-value-2>=1180 `
  --variation-id <string-value-2>=<variation-id-2> `
  --variation-value <string-value-2>=<string-value-2> `
  --variant <string-value-3>=1160 `
  --variation-id <string-value-3>=<variation-id-3> `
  --variation-value <string-value-3>=<string-value-3> `
  --metric self_hosted_feature_flags_engaged_time:continuous:average:<string-value-1>=12,<string-value-2>=26,<string-value-3>=20 `
  --guardrail self_hosted_feature_flags_render_error:binary:once:<string-value-1>=36,<string-value-2>=37,<string-value-3>=35 `
  --guardrail self_hosted_feature_flags_decision_path_link_error:binary:once:<string-value-1>=4,<string-value-2>=5,<string-value-3>=3 `
  --start-date 2026-06-01 `
  --end-date 2026-06-06
```

### Seed Current Aspire Data

`--env-secret` must be the server SDK secret for the target FeatBit environment. The `--env-id` value is kept in the command for readability, but ingestion is authorized by `--env-secret`.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --env-secret <server-sdk-secret> `
  --env-id a30da40d-1f8a-4f4f-86a8-323ac65326d6 `
  --flag-key <flag-key> `
  --variant <string-value-1>=1200 `
  --variation-id <string-value-1>=<variation-id-1> `
  --variation-value <string-value-1>=<string-value-1> `
  --variant <string-value-2>=1180 `
  --variation-id <string-value-2>=<variation-id-2> `
  --variation-value <string-value-2>=<string-value-2> `
  --variant <string-value-3>=1160 `
  --variation-id <string-value-3>=<variation-id-3> `
  --variation-value <string-value-3>=<string-value-3> `
  --metric self_hosted_feature_flags_engaged_time:continuous:average:<string-value-1>=12,<string-value-2>=26,<string-value-3>=20 `
  --guardrail self_hosted_feature_flags_render_error:binary:once:<string-value-1>=36,<string-value-2>=37,<string-value-3>=35 `
  --guardrail self_hosted_feature_flags_decision_path_link_error:binary:once:<string-value-1>=4,<string-value-2>=5,<string-value-3>=3 `
  --start-date 2026-06-01 `
  --end-date 2026-06-06
```

### Seed Through The .NET SDK

Use SDK mode when you want to exercise the same path a .NET application uses: feature flag evaluation followed by custom metric tracking. Generated users include these custom properties:

- `seedVariant`: the readable variant alias from `--variant`
- `seed`: the numeric `--seed` value

If you need exact variant counts, configure the target FeatBit flag rules to return the matching real variation id for each `seedVariant` value. The tool fails if the SDK evaluates a generated user to a different variation id than the one supplied by `--variation-id`.

```powershell
dotnet run tools\seed-release-decision-insights.cs -- `
  --send-mode sdk `
  --env-secret <server-sdk-secret> `
  --env-id a30da40d-1f8a-4f4f-86a8-323ac65326d6 `
  --flag-key <flag-key> `
  --variant <string-value-1>=120 `
  --variation-id <string-value-1>=<variation-id-1> `
  --variation-value <string-value-1>=<string-value-1> `
  --variant <string-value-2>=118 `
  --variation-id <string-value-2>=<variation-id-2> `
  --variation-value <string-value-2>=<string-value-2> `
  --variant <string-value-3>=116 `
  --variation-id <string-value-3>=<variation-id-3> `
  --variation-value <string-value-3>=<string-value-3> `
  --metric self_hosted_feature_flags_engaged_time:continuous:average:<string-value-1>=12,<string-value-2>=26,<string-value-3>=20 `
  --guardrail self_hosted_feature_flags_render_error:binary:once:<string-value-1>=3,<string-value-2>=4,<string-value-3>=4 `
  --start-date 2026-06-08 `
  --end-date 2026-06-08
```

### Parameters

`--evaluation-url`

Evaluation server base URL. Defaults to `http://localhost:5100`.

In SDK mode this value is used for both SDK event delivery and streaming. `http` is converted to `ws` and `https` is converted to `wss` for the streaming URL.

`--env-secret`

Required unless `--dry-run` is set. This is the server SDK secret used by `/api/public/insight/track`.

`--env-id`

Optional label printed in the summary. The actual environment is determined by `--env-secret`.

`--flag-key`

Feature flag key. Must match the flag selected by the release-decision run.

`--variant <name=count>`

Adds one variant population. Repeat once per variation value you want to seed. Metric target specs use these aliases, so the same token must appear in `--variant`, `--variation-id`, `--variation-value`, `--metric`, and `--guardrail`.

Example:

```powershell
--variant <string-value-1>=1200 --variant <string-value-2>=1180 --variant <string-value-3>=1160
```

`--variation-id <variant-name=actual-variation-id>`

Maps a `--variant` alias to the real FeatBit feature flag variation id written into `FlagValue` insight events. This is required when you want the native FeatBit flag Insights page and release-decision analysis to group events under the existing flag variations.

When `--variation-id` is present, the generated exposure data uses that id as the canonical variant key.

For example, if a string flag has three values, use those values as aliases and map each one to the real variation id:

```powershell
--variant <string-value-1>=1200 `
--variation-id <string-value-1>=<variation-id-1> `
--variant <string-value-2>=1180 `
--variation-id <string-value-2>=<variation-id-2> `
--variant <string-value-3>=1160 `
--variation-id <string-value-3>=<variation-id-3>
```

`--variation-value <variant-name=actual-value>` is optional. If omitted, the readable variant name is also used as the insight variation value.

For string flags, prefer passing both `--variation-id` and `--variation-value`:

```powershell
--variant <string-value-1>=1200 `
--variation-id <string-value-1>=<variation-id-1> `
--variation-value <string-value-1>=<string-value-1> `
--variant <string-value-2>=1180 `
--variation-id <string-value-2>=<variation-id-2> `
--variation-value <string-value-2>=<string-value-2> `
--variant <string-value-3>=1160 `
--variation-id <string-value-3>=<variation-id-3> `
--variation-value <string-value-3>=<string-value-3>
```

`--metric <event:type:agg:targets>`

Adds a primary metric event plan.

Format:

```text
event:binary|continuous:once|count|sum|average:<string-value-1>=target,<string-value-2>=target,<string-value-3>=target
```

Examples:

```powershell
--metric mn1:binary:once:<string-value-1>=132,<string-value-2>=165,<string-value-3>=140
--metric revenue:continuous:sum:<string-value-1>=52000,<string-value-2>=61000,<string-value-3>=58000
--metric clicks:continuous:count:<string-value-1>=900,<string-value-2>=1100,<string-value-3>=980
--metric order_value:continuous:average:<string-value-1>=42.5,<string-value-2>=47.2,<string-value-3>=45.8
```

`--guardrail <event:type:agg:targets>`

Adds a guardrail metric event plan. It uses the same format as `--metric`.

Example:

```powershell
--guardrail afa:binary:once:<string-value-1>=36,<string-value-2>=41,<string-value-3>=38
```

`--start-date` / `--end-date`

Inclusive observation window dates in `yyyy-MM-dd` format. Generated exposure and metric events are placed inside this window.

`--batch-size`

HTTP batch size for posting insights. Defaults to `50`.

Only applies to `--send-mode direct`. SDK mode uses the SDK event processor and flushes before exit.

`--send-mode <direct|sdk>`

Controls how events are sent. Defaults to `direct`.

`direct` keeps support for synthetic historical timestamps. `sdk` uses `FeatBit.ServerSdk` and live SDK timestamps.

`--sdk-start-wait-seconds`

SDK initialization wait time. Defaults to `5`.

`--sdk-flush-wait-seconds`

Maximum time to wait for SDK event flushing before exit. Defaults to `30`.

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

### Help

```powershell
dotnet run tools\seed-release-decision-insights.cs -- --help
```
