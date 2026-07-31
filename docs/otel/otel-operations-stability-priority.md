# FeatBit OpenTelemetry Priorities for Operational Stability

> Scope: `modules/back-end` and `modules/evaluation-server`; billing and Guarded Rollout product metrics are excluded.
> Baseline: FeatBit `3cd4cb17`, 2026-07-30. Metric names describe the proposed semantics and are not a final naming specification.

## 1. Conclusion

Add metrics first, then a small number of traces:

1. Deliver M1–M6 in the first iteration for alerting.
2. Make T1, end-to-end Flag Change propagation, the first custom trace.
3. Retain only errors, slow operations, or sampled traces on high-throughput paths.
4. Do not duplicate existing automatic telemetry for HTTP, the .NET runtime, or dependencies.

| Phase | Scope |
|---|---|
| Prerequisite | Correct the OTel service name and endpoint, and alert on `otelcol_*` receiver refusals, export failures, and queue saturation |
| P0 | M1–M6 |
| P1 | T1, M7–M8, T2–T3 |
| P2 | M9–M10, T4–T5 |

Performance levels: **very low** for state gauges and low-frequency counters; **low** for one recording per connection, change, or batch; **medium** for per-message recording or histograms; **high** for per-evaluation, per-fanout-connection, or high-cardinality telemetry.

## 2. Metrics: Highest to Lowest Priority

| ID | Proposed metrics | Purpose | Performance and default policy |
|---|---|---|---|
| **M1 P0** | `streaming.upgrade.requests` Counter; `sockets.active` and `subscriptions.active` Gauge; `connection.closed` Counter; `connection.duration` Histogram | Measure new WebSocket connections per second, physical sockets, logical environment subscriptions, and abnormal closes. One FeatBit Agent `relay-proxy` socket can carry multiple environment subscriptions, so sockets and subscriptions must be counted separately. | Very low for totals; always on. Expose `subscriptions.active{env.id}` only through an on-demand view. Do not scan every connection on each collection. |
| **M2 P0** | `messaging.operations` and `messages.dropped/redelivered` Counter; `queue.depth`, `oldest_message.age`, and `consumer.running/last_success.age` Gauge; `operation.duration` Histogram | Detect MQ publish failures, stopped consumers, backlogs, and silent message loss. Queue depth alone cannot reveal a small number of messages stuck for a long time. | Low to medium for counters; medium for queue queries. Limit attributes to `provider/destination/operation/outcome`. |
| **M3 P0** | `flag_change.operations` Counter; `propagation.duration` Histogram; `fanout.connections{outcome}` Counter; `config.last_success.age` Gauge | Confirm that a Flag Change completed commit, publish, consume, and fanout, and detect cases where WebSockets remain connected while propagation has stopped. The server-side boundary ends at the socket send. | Low; always on. Record target/success/failure once per change. Do not use `flag.key` or `env.id` as metric labels. |
| **M4 P0** | `store.available/selected/last_success.age` Gauge; `health_check.operations/failover.transitions` Counter; `health_check.duration` Histogram | Distinguish a healthy store, fallback store, and no available store, and detect failover flapping. A health endpoint only exposes the current state, not its history. | Very low; always on and outside the evaluation hot path. |
| **M5 P0** | `buffer.items/capacity/bytes` Gauge; `items.dropped` Counter; `flush.operations` and `loop.failures` Counter; `flush.duration/batch.size` Histogram; `worker.running/last_success.age` Gauge | Detect saturation, drops, failed flushes, or silently stopped workers in usage, insight, PostgreSQL notification, and MQ pipelines. | Very low to low; always on. Reduce collection frequency if queue depth requires a database query. |
| **M6 P0** | `ratelimit.decisions{allowed,rejected,fail_open}` Counter; `streaming.validation.operations` Counter | Detect Redis rate-limit fail-open and distinguish invalid WebSocket credentials from unavailable validation dependencies. | Low; always on. Never record tokens, secrets, query strings, IP addresses, or raw error messages. |
| **M7 P1** | `streaming.messages`, `messages.invalid`, and `send.failures` Counter; `message.size` and `sync.duration/payload.size/items` Histogram; `sync.operations` Counter | Diagnose malformed or oversized messages, large payloads, slow full syncs, and socket send failures. | Keep counters on. Histograms are medium cost: prioritize full syncs, errors, and slow operations; do not build ping/pong latency distributions. |
| **M8 P1** | `insight.events{accepted,invalid,publish_failed}` Counter; `request.batch.size/payload.size` Histogram | Distinguish missing ingress, validation rejection, MQ publish failure, and downstream processing failure. HTTP 200 does not prove that events entered the pipeline. | Medium. Record once per request or batch, without per-event high-cardinality attributes. This is not a billing source of truth. |
| **M9 P2** | `evaluations` Counter; `evaluation.batch.size/duration` Histogram | Measure ELS evaluation capacity and separate rule-computation time from HTTP, authentication, and dependency latency. | Medium for the counter; medium to high for duration. Enable the histogram temporarily for diagnostics. Do not label by flag, environment, variant, or context. |
| **M10 P2** | `flag_schedule.executions/lag/duration`; `webhook.deliveries/retries/duration`; `startup.cache_population/duration` | Detect delayed scheduled changes, exhausted webhook retries, and blocked startup cache population. | Very low to low. Do not label by URL, webhook ID, schedule ID, or workspace ID. |

Shared constraints:

- Report active gauges per service instance and aggregate globally at query time.
- Default attributes must be finite enumerations such as `outcome`, `operation`, `connection.type`, and `provider`.
- Expose `env.id` only through controlled views for explicit use cases. Never put tokens, secrets, users, connections, or flag identifiers in metrics.
- Do not expose numeric `revision.lag` until config revisions use a monotonic sequence; the current flag revision is a GUID and cannot be subtracted meaningfully.
- Telemetry backpressure must never block streaming or evaluation.

## 3. Traces: Highest to Lowest Priority

| ID | Trace | Purpose | Performance policy |
|---|---|---|---|
| **T1 P1** | `flag_change.persist → publish → consume → fanout` | Locate whether a change stalled in the database, MQ, consumer, or WebSocket delivery. Create one aggregate `fanout` span per change with target/success/failure counts and total duration. | Low. Sample normal traces and retain errors and timeouts. Never create one fanout span per connection. |
| **T2 P1** | `streaming.handshake → validate → accept/reject` | Locate ordinary or FeatBit Agent `relay-proxy` connection failures in token validation, store access, rate limiting, or WebSocket acceptance. | Low to medium. Sample successful handshakes at a low rate; retain rejections, errors, and slow handshakes; end the span after the handshake. |
| **T3 P1** | `streaming.sync` | Locate store, serialization, payload, or socket-send bottlenecks in full and patch synchronization. | Medium. Retain only errors, timeouts, slow syncs, and a small sample of normal operations. |
| **T4 P2** | `insight/usage ingest → publish → consume → flush` | Locate the asynchronous stage responsible for successful ingress that never reaches storage. | High if traced per event. Trace batches only, retaining errors and slow operations or applying sampling. |
| **T5 P2** | FeatBit Agent Relay Proxy sync, Schedule, and Webhook | Agent sync covers scope/data loading, bootstrap payload creation, the Agent HTTP response, and DataVersion update. Also covers low-frequency Schedule and Webhook stages. | Low and disabled by default. Server tracing ends at the Agent HTTP response; Agent internals require context propagation and export to the same backend. |

If a third-party platform needs change tracking, add a low-frequency structured `featbit.flag.change` event. T1 represents the propagation process; the event represents the point in time when the change occurred.

### 3.1 Trace Controls

Add FeatBit-specific controls that are independent of the global OTel switch:

```text
FEATBIT_OTEL_CUSTOM_TRACES=flag_change
FEATBIT_OTEL_CUSTOM_TRACE_SAMPLE_RATIO=0.05
```

- `flag_change` is low frequency and should be enabled by default or sampled at a low rate.
- `streaming_handshake`, `streaming_sync`, `insight_pipeline`, `agent_relay_sync`, `schedule`, and `webhook` should be disabled by default and enabled temporarily during diagnostics.
- Check the switch before creating spans, reading clocks, or constructing attributes. When disabled, retain only a lightweight condition check.
- Environment-variable changes require a rolling restart. Use dynamic configuration if runtime activation is required, but never fetch configuration remotely on the request path.
- Collector filtering reduces export and storage costs but does not remove in-process span creation costs.

Keep P0 metrics enabled: let metrics trigger the alert, then temporarily enable the relevant trace. The global `OTEL_TRACES_SAMPLER` also affects automatic HTTP traces and is therefore unsuitable as a category-level switch for custom business traces.

## 4. Key Risks Found in the Code Audit

| Risk | Impact | Signals |
|---|---|---|
| A Kafka handler failure may still be followed by offset storage | The failed message is not consumed again | M2, M3, T1 |
| Redis uses `LPop` before processing | The message is lost if the handler fails | M2, T1 |
| The PostgreSQL notification channel uses `DropOldest` and ignores `TryWrite` results | Old notifications can be overwritten without crashing the service | M2, M5 |
| Some producers catch exceptions and only log them | The caller can incorrectly assume that publishing succeeded | M2, T1 |
| A worker can stop without producing further errors | Failure counters alone cannot detect the stopped worker | M2, M5 |
| One FeatBit Agent `relay-proxy` socket maps to multiple environments | Physical socket counts understate subscriptions and failure impact | M1 |
| Fanout sends sequentially | One slow connection extends the entire propagation | M3, M7, T1 |

Telemetry only exposes these risks; acknowledgement, retry, and persistence semantics still require separate fixes.

## 5. Defer for Now

| Item | Reason |
|---|---|
| One span per ELS evaluation | Volume is high. HTTP traces and M9 are sufficient for routine alerting, while per-flag spans introduce cardinality risk. |
| One span per WebSocket message | High volume and low value. Use M7 and error/slow T3 traces instead. |
| One span per fanout connection | A single change would create O(number of connections) spans. Keep one aggregate fanout span. |
| One span covering the entire WebSocket lifetime | A span could remain open for days. Use a short handshake trace, active gauge, and close counter. |
| `env.id` on every SaaS metric | Time-series cardinality, storage, and query costs would be high. Expose only controlled views. |
| Flag, user, context, connection, token, or URL metric labels | These introduce high cardinality or sensitive-data risk. Put specific identifiers only in controlled traces or logs; never record tokens or secrets. |
| Full tracing for 100% of Insight, Usage, or evaluation traffic | CPU, allocation, network, and storage costs would be high, and traces are not an exact counting mechanism. |
| Driving Guarded Rollout directly from platform OTel data | OTel is for observability and correlation; it cannot replace reliable exposure/outcome data and a rollback state machine. |

## 6. First Iteration

Required:

1. M1 Streaming;
2. M2 MQ;
3. M3 Flag Change propagation;
4. M4 Store;
5. M5 Buffer/Worker;
6. M6 rate-limit fail-open;
7. Alerts for the above metrics and `otelcol_*`.

Add T1 only if capacity remains. Let actual alerts and failure modes drive the remaining work.

## 7. Audit References

- [StreamingMiddleware](../../modules/evaluation-server/src/Streaming/StreamingMiddleware.cs)
- [ConnectionManager](../../modules/evaluation-server/src/Streaming/Connections/ConnectionManager.cs)
- [FeatureFlagChangeMessageConsumer](../../modules/evaluation-server/src/Streaming/Consumers/FeatureFlagChangeMessageConsumer.cs)
- [DataSyncService](../../modules/evaluation-server/src/Streaming/Services/DataSyncService.cs)
- [StoreAvailableSentinel](../../modules/evaluation-server/src/Infrastructure/Store/StoreAvailableSentinel.cs)
- [evaluation-server Kafka consumer](../../modules/evaluation-server/src/Infrastructure/MQ/Kafka/KafkaMessageConsumer.cs)
- [evaluation-server PostgreSQL consumer](../../modules/evaluation-server/src/Infrastructure/MQ/Postgres/PostgresMessageConsumer.cs)
- [back-end Kafka consumer](../../modules/back-end/src/Infrastructure/MQ/Kafka/KafkaMessageConsumer.cs)
- [back-end Redis consumer](../../modules/back-end/src/Infrastructure/MQ/Redis/RedisMessageConsumer.cs)
- [UsageTracker](../../modules/back-end/src/Application/Usages/UsageTracker.cs)
- [UsageFlushWorker](../../modules/back-end/src/Infrastructure/AppService/UsageFlushWorker.cs)
- [InsightsWriter](../../modules/back-end/src/Infrastructure/AppService/InsightsWriter.cs)
- [OnFeatureFlagChanged](../../modules/back-end/src/Application/FeatureFlags/OnFeatureFlagChanged.cs)
- [SyncToAgent](../../modules/back-end/src/Application/RelayProxies/SyncToAgent.cs)
- [AgentService](../../modules/back-end/src/Infrastructure/Services/AgentService.cs)
