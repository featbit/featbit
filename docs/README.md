# FeatBit Developer Documentation

User-facing documentation lives at [docs.featbit.co](https://docs.featbit.co). This folder holds
contributor-facing design material that needs to sit next to the code it describes.

## Standards

Ratified specifications that code is expected to conform to.

| Standard | Summary |
| --- | --- |
| [Observability](observability/index.md) | Instrument naming, attribute allowlist, cardinality budget, correlation fields, logging and redaction rules, health-check contract, and trace gating for the API server, evaluation server, and control plane |
| [Instrument registry](observability/instruments.md) | Every custom metric instrument, its type, unit, attributes, and emitting code location |
| [Exporting signals](observability/exporting.md) | Getting metrics, traces, and logs out to your own OpenTelemetry collector, and verifying they arrive |
| [Investigating an incident](observability/investigating.md) | The operator runbook: symptom to root cause via metric, trace, and log correlation |

## Proposals

Design documents for work that is planned or in progress. Each proposal has its own folder under
[`proposals/`](proposals/) with a `README.md` overview.

| Proposal | Status | Summary |
| --- | --- | --- |
| [OpenTelemetry custom metrics](proposals/otel-custom-metrics/README.md) | Superseded by [Observability](observability/index.md) | Custom metric and trace priorities for operational stability across the API server, evaluation server, and control plane |
| [Flag and segment change reliability](proposals/flag-segment-change-reliability-enhancement/README.md) | Draft | Reliable change persistence, message delivery, ELS processing, and WebSocket fanout |
