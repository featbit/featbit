# Release Health

> **Draft proposal.**

Release Health will let teams use metrics from a flag’s environment to assess the impact of a release. The first stage gives each environment a set of reusable connections to Prometheus-compatible services and Azure Monitor Logs. Later stages will use those connections to query metrics.

The [release metric source connection API](./release-metric-source-connections.md) describes how to manage these connections, which permissions each operation requires, and which settings callers can read back.
