# FeatBit Developer Documentation

User-facing documentation lives at [docs.featbit.co](https://docs.featbit.co). This folder holds
contributor-facing design material that needs to sit next to the code it describes.

## Proposals

Design documents for work that is planned or in progress. Each proposal has its own folder under
[`proposals/`](proposals/) with a `README.md` overview.

| Proposal | Status | Summary |
| --- | --- | --- |
| [OpenTelemetry custom metrics](proposals/otel-custom-metrics/README.md) | Draft | Custom metric and trace priorities for operational stability across the API server, evaluation server, and control plane |
| [Flag and segment change reliability](proposals/flag-segment-change-reliability-enhancement/README.md) | Draft | Reliable change persistence, message delivery, ELS processing, and WebSocket fanout |
