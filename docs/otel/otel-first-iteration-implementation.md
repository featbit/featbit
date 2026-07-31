# FeatBit OpenTelemetry: First Iteration

> Companion to [OpenTelemetry Priorities for Operational Stability](./otel-operations-stability-priority.md).
>
> Scope: `modules/back-end` and `modules/evaluation-server`. SDK telemetry, billing, Guarded Rollout metrics, and per-evaluation instrumentation are excluded.

## 1. Shared Foundation

### Task goal

Make FeatBit custom metrics exportable, consistent, and safe for production.

### Why

.NET automatic instrumentation covers HTTP, runtime, and supported dependencies, but not FeatBit-specific states such as active subscriptions or message drops.

### What to measure

Use two custom Meter sources:

- `FeatBit.Backend`
- `FeatBit.EvaluationServer`

Identify telemetry through resource attributes such as `service.name`, `service.version`, `service.instance.id`, and deployment environment.

### How to implement

- Register the relevant Meter through `OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES`.
- Correct the back-end `OTEL_SERVICE_NAME` and the `locahost` OTLP endpoint typo in both Dockerfiles.
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
| `featbit.streaming.upgrade.requests` | New WebSocket attempts by type and outcome |
| `featbit.streaming.sockets.active` | Current physical sockets |
| `featbit.streaming.subscriptions.active` | Current logical environment subscriptions |
| `featbit.streaming.connection.closed` | Normal and abnormal closes |
| `featbit.streaming.connection.duration` | Connection lifetime distribution |

`subscriptions.active{env.id}` is an optional, disabled-by-default detailed view for selected environments.

### How to implement

- Record the upgrade result when the handshake is decided, including rate-limit rejection.
- Maintain socket and subscription counts with atomic deltas in [StreamingMiddleware](../../modules/evaluation-server/src/Streaming/StreamingMiddleware.cs) and [ConnectionManager](../../modules/evaluation-server/src/Streaming/Connections/ConnectionManager.cs).
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
- Report publish success only when the provider confirms delivery. Flag and Segment Change publishing must not treat local enqueue as final success.
- Poll durable queue depth and oldest age in a background task, then expose cached values.
- Do not expose backlog metrics for Redis Pub/Sub because it has no durable queue.
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
- Record publish success only after provider delivery confirmation.
- In [FeatureFlagChangeMessageConsumer](../../modules/evaluation-server/src/Streaming/Consumers/FeatureFlagChangeMessageConsumer.cs), aggregate target, success, failure, and total duration once per change.
- Do not add connection, environment, or flag identifiers to metrics.

The current flag revision is a GUID, so numeric `revision.lag` is deferred until FeatBit has a monotonic config sequence.

Performance impact: low; a fixed number of recordings is made per Flag Change.

## 5. M4 — Store Availability

### Task goal

Expose store health, current selection, probe latency, and failover transitions.

### Why

Readiness shows only the current result. It cannot reveal slow probes, intermittent failures, fallback usage, or failover flapping.

### What to measure

| Metric | Purpose |
|---|---|
| `featbit.store.available` | Last probe result per provider |
| `featbit.store.selected` | Current routing selection |
| `featbit.store.last_success.age` | Time since the provider last passed a probe |
| `featbit.store.health_check.operations/duration` | Probe outcomes and latency |
| `featbit.store.failover.transitions` | Provider selection changes |

### How to implement

- Wrap each existing probe in [StoreAvailableSentinel](../../modules/evaluation-server/src/Infrastructure/Store/StoreAvailableSentinel.cs).
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

Use a fixed buffer/worker name such as `usage`, `insight`, `postgres_notification`, or `store_sentinel`.

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
| `featbit.ratelimit.decisions` | All in-memory and Redis-backed `allowed` and `rejected` decisions; `fail_open` applies only to Redis |
| `featbit.streaming.validation.operations` | Accepted, invalid, and unavailable results that distinguish client errors from dependency failures |

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
- Do not alert on `last_success.age` alone when there is no incoming work.
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
