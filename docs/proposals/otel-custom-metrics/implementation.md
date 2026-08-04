# FeatBit OpenTelemetry: First Iteration

> **Status: Draft proposal.** Nothing here is a ratified specification; instrument names,
> attributes, and phasing are all open to change until the tracking issue is closed.
> Discussion and contributions welcome — see the tracking issue linked from the
> [proposal overview](./README.md).
>
> Companion to [OpenTelemetry Priorities for Operational Stability](./README.md).
>
> Scope: `modules/back-end` and `modules/evaluation-server`. SDK telemetry, billing, Guarded Rollout metrics, and per-evaluation instrumentation are excluded.

## 1. Shared Foundation

### Task goal

Make FeatBit custom metrics exportable, consistent, and safe for production.

### Why

.NET automatic instrumentation covers HTTP, runtime, and supported dependencies, but not FeatBit-specific states such as active subscriptions or message drops.

### What to measure

Use one custom Meter source per service:

| Service | `service.name` | Meter | Instrument namespace |
| --- | --- | --- | --- |
| API server | `featbit-api` | `FeatBit.Api` | `featbit.api.*` |
| Evaluation server | `featbit-els` | `FeatBit.EvaluationServer` | `featbit.evaluation_server.*` |
| Control plane | `featbit-control-plane` | `FeatBit.ControlPlane` | `featbit.control_plane.*` |

Identify instances through resource attributes such as `service.name`, `service.version`, `service.instance.id`, and deployment environment.

### Instrument naming

Instrument names follow `featbit.<service>.<area>.<name>` and the [OpenTelemetry naming conventions](https://opentelemetry.io/docs/specs/semconv/general/naming/):

- Lowercase throughout. Separate namespace components with `.` and words inside a component with `_`.
- Restrict names to letters, digits, `_`, and `.`. A `service.name` value keeps its hyphen (`featbit-api`), but the `<service>` component of an instrument name cannot, so use `api`, `evaluation_server`, and `control_plane`.
- `featbit` is the application prefix the specification recommends for names private to one application, and the system name that [system-specific metrics](https://opentelemetry.io/docs/specs/semconv/general/naming/#system-specific-metrics) must start with. Do not repeat it inside `<service>`.
- Include `<service>` only when the area belongs to a single service. Streaming, store availability, and rate limiting are evaluation-server concerns, so they carry the token. Messaging, flag-change propagation, buffers, and workers are emitted by several services and stay service-neutral, so one query spans all of them and `service.name` supplies the split.
- Units belong in the instrument's `unit` argument, not in the name. Drop `_ms` and `_seconds` suffixes.
- Never append `_total` to a Counter or UpDownCounter.

The instruments that already ship predate this convention. Migrating them is a prefix addition plus a unit-suffix removal:

| Current | Target | Unit |
| --- | --- | --- |
| `control_plane.consistency.commits` | `featbit.control_plane.consistency.commits` | `{commit}` |
| `control_plane.consistency.evicted_commits` | `featbit.control_plane.consistency.evicted_commits` | `{commit}` |
| `control_plane.consistency.time_to_commit_ms` | `featbit.control_plane.consistency.time_to_commit` | `ms` |
| `control_plane.consistency.pending_backlog` | `featbit.control_plane.consistency.pending_backlog` | `{message}` |
| `control_plane.consistency.applied_watermark_lag_ms` | `featbit.control_plane.consistency.applied_watermark_lag` | `ms` |
| `control_plane.consistency.unmatched_dc_count` | `featbit.control_plane.consistency.unmatched_dc_count` | `{datacenter}` |
| `control_plane.consistency.is_leader` | `featbit.control_plane.consistency.is_leader` | `{leader}` |
| `evaluation_server.consistency.heartbeat_staleness_seconds` | `featbit.evaluation_server.consistency.heartbeat_staleness` | `s` |

Renaming an exported metric breaks existing dashboards and alerts, so land the migration in one commit and call it out in the release notes.

Meter names are not governed by the semantic conventions; they surface as `otel.scope.name`. Keep the existing `FeatBit.ControlPlane.Consistency` and `FeatBit.EvaluationServer.Consistency` sources as they are, because the `FeatBit.*` wildcard below exports them either way.

### How to implement

- Register the relevant Meter through `OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES`. This variable is currently set nowhere in the repository, so the custom meters that already exist—`FeatBit.ControlPlane.Consistency` and `FeatBit.EvaluationServer.Consistency`—are silently dropped by the auto-instrumentation. Fix this first; every metric below depends on it.
- Register the prefix wildcard `OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES=FeatBit.*` in each service Dockerfile rather than enumerating meters. Auto-instrumentation accepts either an exact source name or a `Prefix.*` form that [registers the entire prefix](https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/blob/main/docs/manual-instrumentation.md#metrics), so one value covers every existing and future `FeatBit.*` meter with no further Dockerfile change. This makes the `FeatBit.` prefix mandatory for every custom meter name.
- Create instruments once and reuse them.
- Use only finite attributes such as `outcome`, `provider`, `operation`, and `connection.type`.
- Never use flag keys, environment IDs, tokens, users, connection IDs, URLs, or raw errors as default metric labels.
- Gauge callbacks read cached or atomic state only. Telemetry must never block business paths.

## 2. M1 — Streaming Connections

### Task goal

Measure WebSocket arrival rate, active sockets, logical subscriptions, lifetime, and abnormal closes.

### Why

HTTP metrics cannot describe long-lived connection capacity. A FeatBit Agent `relay-proxy` socket may also represent several environment subscriptions.

### What to measure

| Metric | Purpose |
|---|---|
| `featbit.evaluation_server.streaming.upgrade.requests` | New WebSocket attempts by type and outcome |
| `featbit.evaluation_server.streaming.sockets.active` | Current physical sockets |
| `featbit.evaluation_server.streaming.subscriptions.active` | Current logical environment subscriptions |
| `featbit.evaluation_server.streaming.connection.closed` | Normal and abnormal closes |
| `featbit.evaluation_server.streaming.connection.duration` | Connection lifetime distribution |

`subscriptions.active{env.id}` is an optional, disabled-by-default detailed view for selected environments.

### How to implement

- Record the upgrade result when the handshake is decided, including rate-limit rejection.
- Maintain socket and subscription counts with atomic deltas in [StreamingMiddleware](../../../modules/evaluation-server/src/Streaming/StreamingMiddleware.cs) and [DefaultConnectionManager](../../../modules/evaluation-server/src/Streaming/Connections/DefaultConnectionManager.cs).
- Count one subscription for a normal connection and the successfully mapped environment count for an Agent connection.
- Use `try/finally` so active counts are always decremented.
- Do not scan the connection dictionary during metric collection.

Performance impact: very low; work occurs per connection, not per WebSocket message.

## 3. M2 — Messaging and Consumers

### Task goal

Detect publish/consume failures, stopped consumers, queue backlog, old messages, and known message loss.

### Why

The current Kafka, Redis, and PostgreSQL implementations have different delivery and acknowledgement behavior. Logs alone cannot reliably show backlog or a consumer that silently stopped.

### What to measure

| Metric | Purpose |
|---|---|
| `featbit.messaging.operations` | Publish, handle, and settlement outcomes |
| `featbit.messaging.operation.duration` | Delivery or handler duration |
| `featbit.messaging.messages.dropped/redelivered` | Known loss or redelivery |
| `featbit.messaging.queue.depth` | Durable backlog |
| `featbit.messaging.oldest_message.age` | Age of the oldest pending message |
| `featbit.messaging.consumer.running` | Whether the consumer is active |
| `featbit.messaging.consumer.heartbeat.age` | Time since the consumer last showed liveness |
| `featbit.messaging.consumer.last_success.age` | Time since successful message handling |

Default attributes: `provider`, `destination`, `operation`, and `outcome`.

### How to implement

- Instrument the Kafka, Redis, and PostgreSQL adapters rather than every caller.
- Treat each provider as two independent transports. The shipped implementations are asymmetric, so `provider` alone does not describe the delivery guarantee:

| Direction | Kafka | Redis | PostgreSQL |
|---|---|---|---|
| API → ELS | Topic; consumer lag available | Pub/Sub `PublishAsync`; no persistence, no backlog | `pg_notify` drained into a 1000-item bounded channel with `DropOldest` |
| ELS → API | Topic; consumer lag available | Durable list `ListRightPushAsync`/`ListLeftPopAsync`; `LLEN` is the backlog | `queue_messages` polled with a one-minute visibility timeout |

- Expose backlog only where a durable queue exists: `LLEN` for the ELS → API Redis list, a pending-row count for `queue_messages`, and consumer lag for Kafka. Only the API → ELS Redis direction is Pub/Sub and has nothing to measure.
- Poll durable queue depth and oldest age in a background task, then expose cached values.
- Publish confirmation needs a code change before `outcome` can be trusted. The Kafka producer uses fire-and-forget `Produce()`, and every producer catches all exceptions and returns `Task.CompletedTask`, so no caller can tell delivery from failure. Until the Kafka delivery handler and the swallowed exceptions feed a result back, record `enqueued` rather than `delivered`.
- Count a Kafka handler failure as a known drop. Both consumers call `StoreOffset` in a `finally` block regardless of handler outcome ([back-end](../../../modules/back-end/src/Infrastructure/MQ/Kafka/KafkaMessageConsumer.cs), [evaluation-server](../../../modules/evaluation-server/src/Infrastructure/MQ/Kafka/KafkaMessageConsumer.cs)), so a failed message is never replayed. Record handler outcome separately from consume count, otherwise this loss is invisible.
- Set consumer running state in the loop lifecycle and update heartbeat independently from message traffic.
- Record drops only when loss is known; do not invent redelivery information when a provider cannot supply it.

Performance impact: low for counters; queue polling stays outside request and evaluation paths.

## 4. M3 — Flag Change Propagation

### Task goal

Show whether a Flag Change completed persistence, publish, consume, and WebSocket fanout.

### Why

Healthy APIs and connected sockets do not prove that the latest configuration is reaching clients.

### What to measure

| Metric | Purpose |
|---|---|
| `featbit.flag_change.operations` | Outcome for `persist`, `publish`, `consume`, and `fanout` |
| `featbit.flag_change.propagation.duration` | Persistence-to-consume and persistence-to-fanout latency |
| `featbit.flag_change.fanout.connections` | Target, successful, and failed sends |
| `featbit.flag_change.config.last_success.age` | Time since ELS last completed propagation |

The server-side boundary ends after socket send; it does not prove that an SDK applied the update.

### How to implement

- Add a versioned internal message envelope containing `change_id`, `occurred_at`, and the flag payload.
- Deploy consumers that accept both the old raw payload and the new envelope before changing producers.
- Record persistence around the actual flag create/update, not audit-log or cache writes.
- Record publish success only after provider delivery confirmation, which depends on the producer change described in M2.
- In [FeatureFlagChangeMessageConsumer](../../../modules/evaluation-server/src/Streaming/Consumers/FeatureFlagChangeMessageConsumer.cs), aggregate target, success, failure, and total duration once per change.
- Do not add connection, environment, or flag identifiers to metrics.

[`FeatureFlag.Revision`](../../../modules/back-end/src/Domain/FeatureFlags/FeatureFlag.cs) is a `Guid`, but `FeatureFlag.CommittedVersion` is a monotonic `long`. It advances only through `PromotePending`, which the control-plane commit coordinator drives, so it keeps its default value in a standard deployment where the control plane is absent. Numeric `revision.lag` therefore stays deferred for the default topology, and the envelope's `occurred_at` remains the propagation-latency source.

Performance impact: low; a fixed number of recordings is made per Flag Change.

## 5. M4 — Store Availability

### Task goal

Expose store health, current selection, probe latency, and failover transitions.

### Why

Readiness shows only the current result. It cannot reveal slow probes, intermittent failures, fallback usage, or failover flapping.

### What to measure

| Metric | Purpose |
|---|---|
| `featbit.evaluation_server.store.available` | Last probe result per provider |
| `featbit.evaluation_server.store.selected` | Current routing selection |
| `featbit.evaluation_server.store.last_success.age` | Time since the provider last passed a probe |
| `featbit.evaluation_server.store.health_check.operations/duration` | Probe outcomes and latency |
| `featbit.evaluation_server.store.failover.transitions` | Provider selection changes |

### How to implement

- Wrap each existing probe in [StoreAvailableSentinel](../../../modules/evaluation-server/src/Infrastructure/Store/StoreAvailableSentinel.cs).
- Cache the latest result and timestamp for gauge callbacks.
- Keep availability and selection separate: the current implementation may retain a selected provider after all probes fail.
- Count a transition only when the selected provider changes.
- Monitor the sentinel loop through M5 worker metrics.

Performance impact: very low; the existing six-second probe loop performs the work.

## 6. M5 — Buffers and Workers

### Task goal

Detect buffer saturation, overwritten data, flush failure, and background workers that stop.

### Why

Usage, Insights, and PostgreSQL notification paths can remove or overwrite buffered items before successful persistence.

### What to measure

| Metric | Purpose |
|---|---|
| `featbit.buffer.items/capacity` | Current occupancy and limit |
| `featbit.buffer.items.dropped` | Items lost through capacity, flush failure, or shutdown timeout |
| `featbit.buffer.flush.operations/duration/batch_size` | Batch flush result, latency, and size |
| `featbit.worker.running` | Whether a loop is active |
| `featbit.worker.heartbeat.age` | Time since the last loop iteration |
| `featbit.worker.last_success.age` | Time since a successful non-empty flush |
| `featbit.worker.loop.failures` | Loop failures |

Use a fixed buffer/worker name such as `usage`, `insight`, `postgres_notification`, or `store_sentinel`. Only some of these are bounded, and the applicable metric set differs:

| Buffer | Implementation | Applicable metrics |
|---|---|---|
| `usage` | Bounded `Channel` with `DropOldest` in [UsageTracker](../../../modules/back-end/src/Application/Usages/UsageTracker.cs) | Full set, including capacity and drops |
| `postgres_notification` | 1000-item bounded `Channel` with `DropOldest` in the ELS consumer | Full set |
| `insight` | Unbounded `List<object>` behind a lock in [InsightsWriter](../../../modules/back-end/src/Infrastructure/AppService/InsightsWriter.cs) | Occupancy and flush metrics only |
| `store_sentinel` | Worker with no buffer | Worker metrics only |

`InsightsWriter` cannot drop, so it grows until the flush keeps up or the process runs out of memory. Report its occupancy and alert on sustained growth; `featbit.buffer.capacity` and `featbit.buffer.items.dropped` are undefined for it until it is given a bound, which is a code change rather than instrumentation.

### How to implement

- Maintain atomic item counts on enqueue, dequeue, and snapshot.
- Use the bounded-channel item-dropped callback; `TryWrite` may succeed while `DropOldest` evicts an item.
- If a drained batch is not retried after flush failure, count the batch as dropped.
- Record duration and batch size once per flush, not once per item.
- Update heartbeat on idle iterations; update last success only after a non-empty successful flush.
- Measure bytes only when size is already known without extra serialization.

Performance impact: very low to low.

## 7. M6 — Rate Limiting and Streaming Validation

### Task goal

Observe all ELS rate-limit decisions—whether in-memory or Redis-backed—and classify Streaming validation results without exposing sensitive data.

### Why

Rejections can indicate excessive traffic or limits set too low. A Redis-backed distributed limiter can also fail open, silently removing distributed protection. Streaming validation results distinguish bad client input from a server-side dependency outage.

Rate limiting does not require Redis. When enabled in its default non-distributed mode, every ELS instance keeps independent counters in memory. Redis is used only when distributed limiting is enabled and Redis is the configured cache, allowing all ELS instances to share counters.

### What to measure

| Metric | Purpose |
|---|---|
| `featbit.evaluation_server.ratelimit.decisions` | All in-memory and Redis-backed `allowed` and `rejected` decisions; `fail_open` applies only to Redis |
| `featbit.evaluation_server.streaming.validation.operations` | Accepted, invalid, and unavailable results that distinguish client errors from dependency failures |

Use finite attributes for backend, policy, algorithm, result, and reason. Never attach the partition key, environment, IP, token, secret, or raw error.

### How to implement

- Record exactly one result per limiter acquisition; avoid counting a rejection both inside the limiter and in `OnRejected`.
- Instrument both Redis and in-memory limiters.
- When Redis fails or times out, record `fail_open` separately from a normal allow decision and alert on it.
- Add a finite reason code to `ValidationResult`; do not parse metric labels from free-text messages.
- Record validation once after `ValidateAsync`.
- Remove or redact raw tokens, secrets, and query strings from validation logs.

Performance impact: low; this adds counters only, with no timing on the evaluation path.

## 8. Alerts and Collector Health

### Task goal

Turn M1–M6 into dashboards and actionable alerts in the monitoring backend, and detect telemetry loss.

### Why

FeatBit emits metric samples. The OTel Collector receives, batches, and exports them; it is not normally the business alert engine. Prometheus stores the time series and calculates rates, sums, ratios, and time-window conditions. Grafana visualizes those results and can also evaluate alert rules.

Alert rules may run in Grafana Alerting or Prometheus. When Prometheus owns the rules, Alertmanager normally routes the notifications. Collector self-metrics prevent a broken telemetry pipeline from making an unhealthy service appear quiet.

### What to measure

| Area | Minimum alert |
|---|---|
| Streaming | Abnormal close ratio or unexpected connection drop/spike |
| Messaging | Failure, known drop, stale consumer, or backlog above SLO |
| Flag Change | Publish without consume, fanout failure, or slow propagation |
| Store | All providers unavailable or repeated failover |
| Buffer/worker | Sustained high utilization, any drop, or stale worker |
| Rate limit | Any fail-open |
| Collector | Receiver refusal, export failure, or queue saturation |

### How to implement

- Scrape application metrics on Collector port `8889` and Collector internal metrics on `8888`.
- Build dashboards in Grafana. Evaluate alert rules in Grafana Alerting or Prometheus, using Alertmanager when Prometheus owns the rules.
- Alert on sustained conditions where appropriate; avoid paging on one short probe failure.
- Do not alert on `last_success.age` alone when there is no incoming work. The exception is the API → ELS Redis transport: because it is Pub/Sub, an evaluation server that restarts silently misses every change published while it was down and then looks idle rather than stale. When the provider is Redis, pair its `last_success.age` with process uptime and with the publisher-side publish rate.
- Use deployment-specific SLOs and traffic baselines.
- Verify that an exporter outage never blocks FeatBit traffic.

## 9. Optional T1 — Flag Change Trace

T1 is optional and comes after M1–M6 and their alerts.

### Task goal

Locate a sampled Flag Change delay in persistence, publish, consume, or fanout.

### Why

M3 metrics show that propagation is unhealthy; a sampled trace locates whether one Flag Change was delayed or failed in persistence, publish, consume, or fanout.

### What to measure

```text
flag_change.persist -> flag_change.publish -> flag_change.consume -> flag_change.fanout
```

The stages answer:

- `persist`: Was saving the Flag Change slow or unsuccessful?
- `publish`: Was publishing to the internal message system slow or unsuccessful?
- `consume`: Did ELS receive or process the message late?
- `fanout`: Was WebSocket delivery slow or partially unsuccessful?

Create one `flag_change.fanout` span for each Flag Change, covering the complete batch of WebSocket sends. Even if one change targets 10,000 connections, create one span rather than 10,000 connection spans. Record target, success, failure, and total duration on that aggregate span.

The trace ends at the ELS socket-send boundary. It does not prove that the network delivered the message or that an SDK received and applied it. Use M3 metrics for trends and alerts; enable or sample T1 when an incident requires stage-level diagnosis.

### How to implement

- Propagate W3C trace context in the internal message envelope.
- Register the custom `ActivitySource` through `OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES`.
- Control it separately from global tracing:

  ```text
  FEATBIT_OTEL_CUSTOM_TRACES=flag_change
  FEATBIT_OTEL_CUSTOM_TRACE_SAMPLE_RATIO=0.05
  ```

- Keep it disabled or lightly sampled during normal operation.
- No SDK participation is required. A shared observability backend is required only if the two server spans must appear as one trace.

## 10. Definition of Done

- M1–M6 metrics are visible with bounded attributes.
- No sensitive or unbounded identifier appears in metrics.
- Gauge collection performs no I/O or connection scanning.
- Failure scenarios trigger the intended alerts.
- Exporter failure does not affect FeatBit availability.
- Streaming and fanout show no material performance regression.
