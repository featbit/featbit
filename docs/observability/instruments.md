# FeatBit Instrument Registry

> The authoritative list of every custom metric instrument emitted by the FeatBit .NET services.
> Conventions are defined in [`index.md`](./index.md). **Every new instrument must be added here
> in the same change that introduces it**, so everything listed is implemented and present in
> `main` — there are no specified-but-unbuilt entries.
>
> For the inverse — what is deliberately **not** measured, and why — see
> [Known gaps](#known-gaps-what-is-deliberately-not-measured).

Automatic instrumentation (ASP.NET Core, HttpClient, .NET runtime, and supported dependencies) is
out of scope for this registry — it is not FeatBit-specific and is not declared in our code.

## Meters

| Meter | Module |
| --- | --- |
| `FeatBit.Api` | `modules/back-end` |
| `FeatBit.EvaluationServer` | `modules/evaluation-server` |
| `FeatBit.EvaluationServer.Consistency` | `modules/evaluation-server` |
| `FeatBit.ControlPlane` | `modules/control-plane` |
| `FeatBit.ControlPlane.Consistency` | `modules/control-plane` |

Meter names are stable by policy. `OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES` is keyed on the
meter name, so a rename invalidates deployed export configuration. See
[`index.md` §2](./index.md#meter-names).

**One meter name, several `Meter` objects.** Each instrumentation type (`MessagingMetrics`,
`PropagationMetrics`, `StreamingMetrics`, `StoreMetrics`, `RateLimitMetrics`, `ServiceMeter`,
`ControlPlaneMetrics`) constructs its own `Meter` instance under the service's single meter *name*.
This is legal and invisible to exporters — listeners and
`OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES` key on the name, not the object — and it keeps each
instrumentation type self-contained instead of forcing a single global registration point. Tests
that need to isolate one type listen to that type's `Meter` property.

**The back-end assembly is shared by two hosts.** `modules/back-end/src/Domain` is
project-referenced by the control plane, so any instrumentation type declared there exposes a
`Configure(meterName, instrumentPrefix)` that each host calls at startup
(`Api/Setup/ServicesRegister.cs`). Without it the control plane would publish under `featbit.api.*`
and be silently misattributed to the API server.

## Control plane — `FeatBit.ControlPlane.Consistency`

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.control_plane.consistency.commits` | Successful cross-DC commits of a flag or segment version | Counter\<long\> | `{commit}` | `resource_type` | `CommitCoordinatorWorker` |
| `featbit.control_plane.consistency.evicted_commits` | Commits made while a configured DC was absent from the live set | Counter\<long\> | `{commit}` | `dc_id` | `CommitCoordinatorWorker` |
| `featbit.control_plane.consistency.time_to_commit` | Staging-to-commit latency (`now − UpdatedAt`) | Histogram\<double\> | `ms` | `resource_type` | `CommitCoordinatorWorker.RecordTimeToCommit` |
| `featbit.control_plane.consistency.pending_backlog` | Items staged but not yet committed | ObservableGauge\<long\> | `{item}` | `resource_type` | `CommitCoordinatorWorker` |
| `featbit.control_plane.consistency.applied_watermark_lag` | How far a DC trails the most-advanced live DC's applied watermark | ObservableGauge\<long\> | `ms` | `dc_id` | `CommitCoordinatorWorker` |
| `featbit.control_plane.consistency.unmatched_dc_count` | DCs whose configured Redis `DcId` and reported ELS lease disagree | ObservableGauge\<long\> | `{dc}` | `direction` | `DcIdConsistencyChecker` |
| `featbit.control_plane.consistency.is_leader` | 1 while this instance holds the leader lock, else 0 | ObservableGauge\<int\> | `{leader}` | *(none)* | `RedisLeaderElector`, `AlwaysLeaderElection` |

`is_leader` is registered on a `Meter` **owned by the elector instance** rather than a static
`Meter`. Multiple electors can exist in one process (integration tests exercise two competing
instances), and each must report its own state. Because the `instance_id` attribute has been
removed, tests distinguish electors by listening per-`Meter` instance rather than by tag.

## Evaluation server — `FeatBit.EvaluationServer.Consistency`

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.consistency.heartbeat_staleness` | Seconds since this pod last published a heartbeat to the control plane | ObservableGauge\<long\> | `s` | *(none)* | `HeartbeatFreshnessHealthCheck` |

---

## Cross-service instruments

These are emitted by the shared primitives in `modules/shared/Observability/`, which all three
services reference, so the same instrument name appears under each service's prefix. `<svc>` below
stands for `api`, `evaluation_server`, or `control_plane`.

### Messaging (`MessagingMetrics`)

Recorded by the transport adapters, so coverage is complete by construction and every new publish
site is instrumented for free.

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.<svc>.messaging.published` | Messages handed to the transport — `enqueued`, not confirmed delivered | Counter\<long\> | `{message}` | `provider`, `destination`, `outcome`, `error_type` | `{Redis,Kafka,Postgres}MessageProducer` |
| `featbit.<svc>.messaging.publish_duration` | Time spent inside the publish call | Histogram\<double\> | `ms` | `provider`, `destination`, `outcome` | as above |
| `featbit.<svc>.messaging.consumed` | Messages consumed, by outcome | Counter\<long\> | `{message}` | `provider`, `destination`, `outcome`, `error_type` | `{Redis,Kafka,Postgres}MessageConsumer` |
| `featbit.<svc>.messaging.consume_duration` | Time spent handling one consumed message | Histogram\<double\> | `ms` | `provider`, `destination`, `outcome` | as above |
| `featbit.<svc>.messaging.unroutable` | Messages received for a topic with no registered handler | Counter\<long\> | `{message}` | `provider`, `destination` | as above |
| `featbit.<svc>.messaging.redelivered` | Messages delivered more than once | Counter\<long\> | `{message}` | `provider`, `destination` | back-end `PostgresMessageConsumer` |
| `featbit.<svc>.messaging.delivery_failures` | Broker-reported failures arriving after the publish call returned | Counter\<long\> | `{message}` | `provider`, `destination`, `error_type` | `KafkaMessageProducer` delivery handler |
| `featbit.<svc>.messaging.backlog` | Messages awaiting consumption, sampled in the background. `-1` when unknown | ObservableGauge\<long\> | `{message}` | `provider`, `destination` | `MessagingBacklogSampler` |

`published{outcome=enqueued}` means *accepted by the transport*, **not** *delivered*. Every producer
is fire-and-forget and swallows publish exceptions, so `enqueued` is the strongest honest claim the
code supports. Reporting `success` would assert a guarantee that does not exist. Upgrading to real
confirmation is a behavior change, and is deliberately out of scope for instrumentation work.

`delivery_failures` is a **separate counter, not an outcome on `published`**. Kafka's broker report
arrives long after the publish call returned and its scope closed, so folding the two together would
double-count the message.

`consume_duration` measures **handling only** and never the blocking `Consume()` call — an idle
topic would otherwise report enormous durations that look identical to a stall.

> **`destination` is the canonical topic on every transport, including Postgres.** The Postgres
> transport addresses `LISTEN`/`NOTIFY` channels, so `Topics.ToChannel` maps each logical topic onto
> a channel name — `featbit-feature-flag-change` becomes `featbit_feature_flag_change_channel`. The
> evaluation server's consumer is driven by channel notifications, so it maps back through
> `Topics.FromChannel` before tagging telemetry; the channel name is still what the handler lookup
> and the `LISTEN`-specific log events use. Without that mapping the producer would tag the topic
> while the consumer tagged the channel, and reconciling `published` against `consumed` on
> `destination` would yield two one-sided series instead of one matched pair. `FromChannel`
> deliberately returns an unrecognised channel unchanged rather than throwing the way `ToChannel`
> does, so an unroutable notification is still recorded — instrumentation must never be able to stop
> message delivery.

> **The Postgres pub/sub list is a silent-failure trap.** A topic reaches the evaluation server over
> `LISTEN`/`NOTIFY` only if `PostgresMessageProducer` treats it as a notification topic *and*
> `Topics.ToChannel` maps it. Miss either and the row is written as `Pending`, no notification is
> issued, and nothing consumes it — the consumer's catch-up sweep only runs on reconnect, and the
> polling consumer drains a different topic list entirely. The publish still succeeds and is counted
> as `enqueued`, so the failure is invisible from the producer's side: a message written, counted,
> and never delivered. This is exactly how `featbit-control-plane-command` was lost under Postgres
> while working normally on Redis and Kafka, and it was found by reconciling `published` against
> `consumed` per destination rather than by any test. The channel names are a hand-maintained
> cross-module contract — the back end calls `pg_notify` on them, the evaluation server issues
> `LISTEN` on them, and neither module can reference the other — so both sides pin the literals in
> `TopicsTests`.

`redelivered` is **Postgres-only, by construction**. The back-end's poll query already increments
`deliver_count` on every delivery for crash recovery, so the counter reads existing data and costs
one extra column in the `returning` clause. Kafka and Redis have nothing equivalent to count: both
Kafka consumers commit the offset in a `finally` regardless of outcome, and the Redis consumer pops
before processing — so under those providers a message is delivered exactly once or not at all, and
the series is legitimately absent rather than zero. Alert on the *rate*, not the total: a steady
trickle after a restart is crash recovery working correctly, while a sustained rate means handlers
are failing to make progress.

#### Backlog depth and the background sampler

`backlog` answers the one question the rate counters cannot: **is the queue draining or filling?**
A healthy `consumed` rate and a growing backlog look identical until the depth is measured.

It is the only instrument in this registry produced by a **background service** rather than by the
code path it describes, and that is deliberate. Reading depth costs a round trip to Redis, Postgres,
or Kafka. An `ObservableGauge` callback runs on the collector's schedule and is expected to return
immediately, so issuing that I/O from inside one would put unbounded blocking work on the metrics
export path, where a slow datastore stalls collection for *every other instrument in the process*.
`MessagingBacklogSampler` therefore does the I/O on its own loop and the gauge callback reads one
cached `long`.

**This is the one part of the observability work that adds runtime behavior** — a new periodic query
against a production datastore. Everything about it is bounded and fail-quiet as a result:

| Property | Behavior |
| --- | --- |
| Interval | `Observability:Messaging:BacklogSampleIntervalSeconds`, default **30 s**, floored at **5 s**. `0` or negative **disables** sampling entirely; an unparseable value falls back to the default, so a typo cannot silently turn the diagnostic off |
| Topic set | Fixed at startup from the same list the consumer drains, so gauge cardinality is bounded and a topic can never be consumed without being watched |
| Unknown | Reported as **`-1`**, never `0`. A zero reads as "drained", which is the most misleading thing a backlog gauge can say while a broker is unreachable |
| Probe failure | Caught per provider. That provider's topics go to `-1`, other providers are still sampled, the loop does not fault, and `worker.loop_failures` records it. A diagnostic must never be the reason a service stops |
| Postgres cost | The count query sends `set local statement_timeout = 3000` **and** a client-side command timeout. The `queue_messages` index leads with `not_visible_until`, so a grouped count over a large backlog can degrade — and a large backlog is exactly when someone is reading this number |

**Alert on `-1` as well as on a high value.** A gauge stuck at `-1` means the sampler cannot reach
the datastore, which is a different and usually more urgent problem than a deep queue.

Per-transport meaning and scope:

| Transport | Service | How depth is read | Notes |
| --- | --- | --- | --- |
| Redis | API | `LLEN` per list-consumed topic | O(1). Pub/sub channels are excluded — an undelivered pub/sub message is discarded rather than queued, so its depth is permanently `0`, which would read as "healthy and drained" |
| Postgres | API | `count(*)` over `status = 'Pending'`, grouped by topic | `Processing` rows have been claimed and are not waiting; `Failed` rows are terminal, so counting them would make the backlog appear to grow forever after one poison message |
| Kafka | API and ELS | Committed offset vs. high watermark, per partition, summed per topic | Read through `KafkaLagReader`, shared with the `Kafka Consumer Group Progress` diagnostic check so the endpoint and the gauge cannot disagree. Never joins the consumer group |

**The evaluation server samples Kafka only, and the omissions are deliberate rather than
unfinished.** Its Postgres consumer uses `LISTEN`/`NOTIFY`, so there is no queue table to count; its
Redis consumer uses a pub/sub subscription, which has no backlog by construction. For that service
Kafka lag is also the most direct available answer to "are flag changes reaching SDK clients?",
because everything downstream of its consume loop is in-process fan-out.

**Kafka lag reads as unknown immediately after an ELS restart.** That service assigns itself a fresh
consumer group per process (`evaluation-server-{guid}`), which has committed nothing yet — so `-1`
here is startup, not a fault.

### Change propagation (`PropagationMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.<svc>.propagation.stages` | Propagation stages completed in this service | Counter\<long\> | `{stage}` | `resource_type`, `stage`, `outcome` | see below |
| `featbit.<svc>.propagation.stage_duration` | Duration of one propagation stage | Histogram\<double\> | `ms` | `resource_type`, `stage`, `outcome` | see below |
| `featbit.<svc>.propagation.deliveries` | Per-connection sends during a change fan-out | Counter\<long\> | `{delivery}` | `resource_type`, `outcome` | ELS `{FeatureFlag,Segment}ChangeMessageConsumer` |

`stage` values: `persist`, `publish` (API — `OnFeatureFlagChangedHandler`, `OnSegmentChangeHandler`);
`relay` (control plane — `FeatureFlagChangeMessageHandler`, `SegmentChangeMessageHandler`);
`fanout` (ELS change consumers). `consume` is reserved and currently covered by
`messaging.consumed`.

Fan-out is **counted per delivery but timed per change**. A single change can fan out to thousands
of connections, so a per-connection histogram would measure fan-out width rather than latency. The
`deliveries{outcome=failure}` rate is what exposes a partial fan-out — otherwise invisible, because
the loop catches per-connection exceptions and continues.

`stages{outcome=partial}` is distinct from both success and failure: a fan-out that reached most
connections is neither, and collapsing it into either hides the only interesting case.

There is deliberately **no end-to-end propagation latency instrument**, even though trace context
now crosses the queue on every transport. A metric spanning services would have to be recorded by
whichever service happens to be last, attributing another service's time to itself. Per-stage
timings localize a stall to a service, and the joined trace supplies the end-to-end number for the
individual change you are actually looking at.

### Workers and buffers (`WorkerObservability`, `BufferObservability`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.<svc>.worker.running` | 1 while the worker loop is running, else 0 | ObservableGauge\<long\> | `{worker}` | `worker` | every `BackgroundService` |
| `featbit.<svc>.worker.heartbeat_age` | Seconds since the loop last iterated (`-1` before the first) | ObservableGauge\<long\> | `s` | `worker` | as above |
| `featbit.<svc>.worker.last_success_age` | Seconds since the worker last completed useful work (`-1` before the first) | ObservableGauge\<long\> | `s` | `worker` | as above |
| `featbit.<svc>.worker.loop_failures` | Exceptions escaping the worker loop body | Counter\<long\> | `{failure}` | `worker`, `error_type` | as above |
| `featbit.<svc>.buffer.items` | Items currently buffered | ObservableGauge\<long\> | `{item}` | `buffer` | `InsightsTracker`, `UsageTracker`, ELS Postgres channel |
| `featbit.<svc>.buffer.capacity` | Configured buffer capacity | ObservableGauge\<long\> | `{item}` | `buffer` | as above |
| `featbit.<svc>.buffer.items_dropped` | Items discarded because the buffer was full | Counter\<long\> | `{item}` | `buffer` | `UsageTracker`, ELS Postgres channel |
| `featbit.<svc>.buffer.blocked_writers` | Callers currently blocked waiting to write | ObservableGauge\<long\> | `{writer}` | `buffer` | `InsightsTracker` |
| `featbit.<svc>.buffer.write_wait` | How long a caller stayed blocked waiting to write | Histogram\<double\> | `ms` | `buffer` | `InsightsTracker` |
| `featbit.<svc>.buffer.bytes` | Payload bytes currently buffered | ObservableGauge\<long\> | `By` | `buffer` | `InsightsTracker` |

**Heartbeat versus last-success is the whole point.** A fresh heartbeat with a stale last-success
means the loop is spinning but accomplishing nothing; both stale means it has stopped. Neither is
distinguishable from a healthy idle worker without both gauges. Ages report `-1` before the first
occurrence, never `0`, so "never happened" cannot be mistaken for "just happened".

**The backlog sampler is itself a worker**, registered as `mq_backlog_sampler`. So the question "is
the queue depth I am looking at current?" has a direct answer:
`worker.last_success_age{worker="mq_backlog_sampler"}` is the age of the newest reading, and
`worker.loop_failures` counts probes that failed. A sampler with no probes to run — every provider
except Kafka in the evaluation server — exits immediately rather than spinning an empty timer, so
`worker.running` stays honest about what is actually running.

**Buffer signal depends on the buffer's full mode, and they are not interchangeable.**
`InsightsTracker` is `FullMode.Wait`, so it back-pressures the calling request thread — blocked
writers and wait duration are the signal, and occupancy is nearly always full. `UsageTracker` and
the ELS Postgres channel are `DropOldest`, so the drop counter is the signal — their occupancy looks
perfectly healthy at exactly the moment data is being lost. A drop is detected by checking
`Reader.Count >= capacity` immediately *before* the write, because `TryWrite` on a `DropOldest`
channel returns `true` even when it discards.

Worker and buffer names come from `WorkerNames` / `BufferNames` and are **constants, not `nameof`**:
a class rename would otherwise silently rename the metric series with no compile error and no test
failure.

**`buffer.bytes` is opt-in and is registered by `InsightsTracker` alone.** It is affordable there
because `InsightMessageHandler` already holds the serialized message and would otherwise discard it
after parsing, so the measurement costs a byte count rather than a second serialization on the
ingest path. Byte tracking is opt-in rather than always-on for the same reason `buffer.items` takes
an explicit occupancy provider: a buffer whose callers never supply sizes would export a constant
zero, and a zero reads as "holding no data" rather than as "not measured". The other two buffers
deliberately do not enable it — see
[Known gaps](#known-gaps-what-is-deliberately-not-measured).

Worker liveness must be alerted on but must **not** be wired into the liveness probe — failing
liveness restarts the pod and readily produces a restart loop. See [`index.md` §9](./index.md).

### Insights (`InsightsMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.insights.received` | Insight events received from SDKs, by outcome | Counter\<long\> | `{insight}` | `outcome` | `InsightController` |
| `featbit.api.insights.persisted` | Insight events written to the analytics store, by outcome | Counter\<long\> | `{insight}` | `outcome` | `InsightsFlushWorker` |
| `featbit.api.insights.batch_size` | Number of events in one flush batch | Histogram\<int\> | `{insight}` | `outcome` | `InsightsFlushWorker` |
| `featbit.api.insights.flush_duration` | Time to persist one batch | Histogram\<double\> | `ms` | `outcome` | `InsightsFlushWorker` |
| `featbit.evaluation_server.insights.request_size` | Declared body size of one ingestion request | Histogram\<long\> | `By` | *(none)* | `InsightController` |

This is the one instrumentation type that is emitted by **two different services** at two different
ends of the same pipeline, which is why the prefixes above differ. `received` is recorded only by the
evaluation server; `persisted`, `batch_size`, and `flush_duration` only by the back-end. Both hosts
call `InsightsMetrics.Configure` at startup.

**`received` and `persisted` are separate instrument names, not one counter with a stage attribute,
and the gap between them is the entire diagnostic.** Insights are the input to every experiment
result and usage figure the product reports. Events arriving at the evaluation server but never
written by the back-end is silent data loss that quietly corrupts those results, and it is only
visible as a sustained difference between two counters. A stage attribute would make that a filter
rather than a subtraction, and would break the moment the two services disagreed about anything else
on the tag set.

**`outcome=rejected` on `received` was previously invisible from every angle.** The ingestion
endpoint filters on `IsValid()` and then answers `200 OK` whether anything survived the filter or
not, so an SDK sending nothing but malformed events looks identical to one sending none. That
behavior is unchanged; it is now counted.

**`persisted` counts events, not batches.** The flush worker's worker metrics already report that
a loop iteration failed. What they cannot report is whether that cost 1 event or 10,000 — which is
what turns "a flush failed" into "we dropped 8,400 insights". A failed batch is not retried.

**`request_size` is read from `Content-Length`, so it costs a header read and nothing else.** It is
the only signal that separates "one SDK is sending far too much per request" from "many SDKs are
sending a normal amount", which are the same line on an event-count chart but need opposite
responses. A **chunked request has no `Content-Length` and is therefore not recorded at all** —
recording a zero would claim an empty body, which is the opposite of what a chunked upload usually
means. The instrument carries **no attributes**: it is a property of the request, and every
attribute available at that point is either already on `received` or unbounded.

> The `outcome` values here are `success`, `rejected`, and `failure`, so that `outcome` keeps one
> vocabulary across the whole estate — see [`index.md` §3](./index.md).

---

## API server — `FeatBit.Api`

### Requests (`RequestMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.api.request.total` | MediatR requests by request type and outcome | Counter\<long\> | `{request}` | `operation`, `outcome` | `ObservabilityBehaviour` |
| `featbit.api.request.duration` | Duration of a MediatR request handler | Histogram\<double\> | `ms` | `operation`, `outcome` | `ObservabilityBehaviour` |

`operation` is the MediatR request type name — a closed set fixed at compile time, one series per
command/query. The request's *contents* (flag keys, user identifiers, environment ids) are never
recorded.

This measures the **handler**, not the endpoint. HTTP server metrics conflate the handler with model
binding, auth, and serialization, so they can only say "the API is slow"; this attributes latency to
a specific command.

`outcome` adds two values beyond the standard set: `validation_failed` and `cancelled`. Both are kept
out of the failure rate deliberately — a client sending bad input or disconnecting is not a server
fault, and folding either in would make normal client behavior look like an outage. They are
counted rather than dropped because a spike in `cancelled` is itself a symptom of a slow handler.

`ObservabilityBehaviour` is registered **after** `ValidationBehaviour` in
`Application/ConfigureServices.cs` and `control-plane/Api/Setup/ServicesRegister.cs`. MediatR runs
behaviors in registration order, so validation rejections are observed as an outcome rather than
being timed as handler work.

**The instruments live on `RequestMetrics`, not on the behavior.** The behavior is a generic type, so
static instruments on it would be created once per closed generic *and* would bake in a meter name
that is wrong for whichever of the two hosts did not write it. The control plane calls
`RequestMetrics.Configure(FeatBitMeters.ControlPlane, …)` at startup and therefore publishes under
`featbit.control_plane.request.*`.

### Authentication and authorization (`AuthMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.api.auth.logins` | Login attempts by method and outcome | Counter\<long\> | `{login}` | `operation`, `outcome`, `reason` | `IdentityService`, `SocialController`, `SsoController` |
| `featbit.api.auth.authorization_decisions` | Permission checks by resource type and outcome | Counter\<long\> | `{decision}` | `resource_type`, `outcome`, `reason` | `DefaultPermissionChecker` |
| `featbit.api.auth.license_checks` | License feature checks by feature and outcome | Counter\<long\> | `{check}` | `operation`, `outcome`, `reason` | `LicenseService` |

`operation` on `auth.logins` is the **login method** — `password`, `oauth`, `oidc`, or `unknown` —
not the provider name from the request. An OAuth provider name arrives in the body of an
`[AllowAnonymous]` endpoint, so it is only used after it resolves against a configured provider;
anything else collapses to `unknown`. `operation` on `auth.license_checks` is likewise only the
feature name after `LicenseFeatures.IsDefined` accepts it.

**Password failures record one reason, `invalid_credentials`, for both "no such user" and "wrong
password".** The HTTP response deliberately does not distinguish them, because distinguishing them
turns the endpoint into a user-enumeration oracle. A metric is read by a wider audience than the
response, so splitting the reason here would reintroduce the oracle through telemetry. This is
pinned by `AuthMetricsTests`.

`auth.authorization_decisions` separates `unmapped_permission` and `invalid_resource` from
`policy_denied`. The first two are configuration or code faults that present to the user exactly
like a legitimate denial, and were previously indistinguishable from one.

### Webhooks (`WebhookMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.api.webhook.deliveries` | Webhook deliveries, counted once per webhook after all retries | Counter\<long\> | `{delivery}` | `outcome`, `reason` | `WebhookSender` |
| `featbit.api.webhook.attempts` | Individual HTTP attempts, including retries | Counter\<long\> | `{attempt}` | `outcome`, `reason` | `WebhookSender` |
| `featbit.api.webhook.attempt_duration` | Duration of one HTTP attempt | Histogram\<double\> | `ms` | `outcome`, `reason` | `WebhookSender` |

**Attempts and deliveries are separate instruments, and the difference between them is the
diagnostic.** The sender retries up to three times, so three failed attempts followed by a success
is a healthy delivery to a flaky endpoint, while three failed attempts and a failed delivery is a
customer-visible notification that never arrived. A single counter cannot tell those apart.

`reason` distinguishes the failures that never reach the network — `template_error` (a broken
Handlebars template), `empty_payload`, and `blocked` (the anti-SSRF guard) — from `http_error` and
`transport_error`. Before this, all five looked identical from outside the process.

**No URL is recorded.** Webhook URLs are customer-supplied and routinely carry a secret in the path
or query. The URL is in the log line for the same delivery; the metric only needs the shape of the
failure.

### Scheduled flag changes (`ScheduleMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.api.schedule.applied` | Scheduled flag changes applied, by outcome | Counter\<long\> | `{schedule}` | `outcome` | `FlagScheduleWorker` |
| `featbit.api.schedule.apply_duration` | Time to apply one schedule | Histogram\<double\> | `ms` | `outcome` | `FlagScheduleWorker` |
| `featbit.api.schedule.due` | Schedules found due on one worker tick | Histogram\<int\> | `{schedule}` | *(none)* | `FlagScheduleWorker` |
| `featbit.api.schedule.lag` | Time between a schedule's scheduled moment and its application | Histogram\<double\> | `ms` | *(none)* | `FlagScheduleWorker` |

`schedule.due` is what turns "schedules are being applied" into "schedules are being applied fast
enough". A backlog that grows on every 45-second tick is invisible from the applied counter alone,
which looks perfectly healthy while falling further behind.

**`schedule.lag` is the only instrument that answers the complaint that actually arrives.** "My
09:00 rollout went out at 09:40" cannot be reconstructed from `applied`, `due`, or
`apply_duration` — the last of those measures how long the work took *once it started*, not how
late it started. Lag measures lateness directly.

Two properties matter when alerting on it. **Lag is never below the poll interval**, because the
worker only discovers due schedules on its 45-second tick, so a threshold must be a multiple of that
rather than a small absolute number. And **negative lag is discarded rather than clamped to zero**:
a negative sample can only come from clock skew between the writer and the worker, and either
recording it or flooring it at zero would drag the percentiles down and mask real lateness — a zero
would additionally claim the schedule went out exactly on time.

Nothing retries a failed schedule, so `schedule.applied{outcome="failure"}` is a promise to a
customer that will never be kept. It warrants an alert rather than a dashboard panel.

### Startup (`StartupMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.api.startup.stages` | Startup stages completed, by outcome | Counter\<long\> | `{stage}` | `stage`, `outcome` | `CachePopulatingHostedService` |
| `featbit.api.startup.stage_duration` | Duration of one startup stage | Histogram\<double\> | `ms` | `stage`, `outcome` | `CachePopulatingHostedService` |

Cache population runs inside `StartAsync` and rethrows, so a failure aborts the host before it can
serve anything. The failure is recorded **before** the rethrow, which is the only reason it is
visible at all. `stage` currently has one value, `cache_population`; it exists as an attribute so
further stages can be added without a new instrument.

### Outbound dependencies (`DependencyMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.api.dependency.requests` | Outbound HTTP requests to a named dependency, by outcome | Counter\<long\> | `{request}` | `destination`, `operation`, `outcome`, `reason` | `DependencyMetricsHandler` |
| `featbit.api.dependency.duration` | Duration of one outbound request | Histogram\<double\> | `ms` | `destination`, `operation`, `outcome`, `reason` | `DependencyMetricsHandler` |

`destination` is a logical dependency name, never a host or URL, drawn from a closed vocabulary
(`DependencyNames`): `billing`, `agent` (relay proxy agents), `oidc` and `oauth` (the two SSO
clients), and `clickhouse`. `operation` is the HTTP method.

**Webhook deliveries are deliberately absent from this family.** They have their own instruments
with their own retry semantics, so routing them through here as well would double-count them. If
you add a new `HttpClient`, attach the handler with a new `DependencyNames` constant unless the
component already measures itself.

**`reason` is the status *class*, not the status code** — `http_3xx`, `http_4xx`, `http_5xx`, plus
`ok`, `timeout`, and `transport_error`. `404` and `422` are the same operational problem, and one
series per status code would spread a single incident across a dozen thin lines.

**This is instrumented as a `DelegatingHandler` on a named `HttpClient`, not inside the service.**
Every one of `BillingService`'s eleven methods catches its exception and returns `null`, so the
status code is discarded before any caller sees it — the handler observes it first. Instrumenting
the methods would also have to be repeated for each method added later; the handler cannot drift.
The handler is registered on the named `billing` client specifically rather than globally, because a
global handler would double-count webhook traffic, which has its own retry-aware instrumentation.

Plus the cross-service messaging, change-propagation, worker/buffer, and insights instruments above
under the `featbit.api.` prefix.

---

## Evaluation server — `FeatBit.EvaluationServer`

### Streaming (`StreamingMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.streaming.upgrades` | WebSocket upgrade attempts, accepted or rejected | Counter\<long\> | `{connection}` | `connection_type`, `outcome`, `reason` | `StreamingMiddleware` |
| `featbit.evaluation_server.streaming.closed` | Streaming connections closed, by close reason | Counter\<long\> | `{connection}` | `connection_type`, `reason` | `StreamingMiddleware` |
| `featbit.evaluation_server.streaming.connection_duration` | How long a streaming connection lasted | Histogram\<double\> | `s` | `connection_type`, `reason` | `StreamingMiddleware` |
| `featbit.evaluation_server.streaming.active_sockets` | Currently open streaming WebSockets | ObservableGauge\<long\> | `{connection}` | *(none)* | `StreamingMiddleware` |
| `featbit.evaluation_server.streaming.subscriptions` | Currently registered logical connections | ObservableGauge\<long\> | `{subscription}` | *(none)* | `DefaultConnectionManager` |
| `featbit.evaluation_server.streaming.messages` | Client messages dispatched, by message type and outcome | Counter\<long\> | `{message}` | `operation`, `outcome`, `reason` | `MessageDispatcher` |
| `featbit.evaluation_server.streaming.message_duration` | Time to handle one client message | Histogram\<double\> | `ms` | `operation`, `outcome`, `reason` | `MessageDispatcher` |
| `featbit.evaluation_server.streaming.received_message_size` | Size of one client message read off the socket | Histogram\<int\> | `By` | `operation`, `outcome`, `reason` | `MessageDispatcher` |
| `featbit.evaluation_server.streaming.sent_message_size` | Size of one server message written to the socket | Histogram\<int\> | `By` | `operation` | `Connection`, `ConnectionContext` |

**Sockets and subscriptions are counted separately, and the ratio is itself diagnostic.** A relay
proxy opens one socket but registers N logical connections, so the two numbers legitimately differ;
collapsing them would hide both the proxy's fan-in and a socket leak.

The `connection_type` attribute is **normalized** through `StreamingMetrics.Normalize` to
`client` / `server` / `relay_proxy` / `unknown`. It originates in a caller-supplied query parameter,
so passing it through unmodified would let any caller mint unbounded attribute values.

**`operation` on `streaming.messages` is the message type, and it comes straight off the socket.**
It is therefore only used *after* it matches a registered handler; until then it is the fixed
`unknown` sentinel. Passing the raw wire value through would let any connected client mint an
unbounded number of series by sending arbitrary message types.

`reason=invalid_json` covers a message that arrives without the `messageType` or `data` properties
the dispatcher needs. That case previously hit a bare `return` — no log, no metric, no trace — so a
client whose messages were malformed was indistinguishable from one sending nothing at all.

**Both size histograms are free, and that is why they exist in this form.** The inbound size is read
from the already-reassembled receive buffer inside `MessageDispatcher.HandleMessageAsync`, which
both the single-fragment and multi-fragment receive paths funnel through — so one measurement point
covers both. The outbound size is the length of the byte array the send path already produced;
serializing a second time purely to measure it would have been a real regression on the hot path,
which would not have been worth any amount of insight.

**The inbound size is recorded on rejections too.** A rejected message is precisely the one whose
size matters most — it is how an oversized or malformed client is told apart from a merely chatty
one. The size is optional in the API, and callers that genuinely do not know it record nothing
rather than a zero.

**`operation` on `sent_message_size` is safe for a different reason than the inbound direction.**
Every `ServerMessage` in the repository is constructed with a `MessageTypes.*` constant, so the
outbound vocabulary is FeatBit-authored and bounded by construction — unlike the inbound message
type, which arrives off the wire and must be matched against a registered handler first. The
outbound histogram carries no `outcome`: it is recorded at the point of writing, where the send has
either thrown or it has not.

### Data sync (`SyncMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.sync.payloads` | Data-sync payloads built, by sync type and outcome | Counter\<long\> | `{payload}` | `operation`, `connection_type`, `outcome` | `DataSyncService`, `SdkController` |
| `featbit.evaluation_server.sync.duration` | Time to build one sync payload | Histogram\<double\> | `ms` | `operation`, `connection_type`, `outcome` | `DataSyncService`, `SdkController` |
| `featbit.evaluation_server.sync.payload_items` | Flags and segments in one payload | Histogram\<int\> | `{item}` | `operation`, `connection_type`, `outcome` | `DataSyncService`, `SdkController` |

`operation` is one of `full`, `patch`, `rp_full`, `rp_patch`, `http_full`, or `http_patch` — decided
by a compile-time switch on the connection type and the requested timestamp, never read from the
request.

**HTTP polling is a separate pair of `operation` values, not a merged one and not a new attribute.**
The two `http_*` values come from the `sdk/server/latest-all` and `sdk/client/latest-all` endpoints,
which polling SDKs and relay proxies use instead of the WebSocket. A deployment can shift between
the two transports with no code change at all, and merging them would hide exactly that shift; a
`transport` attribute would have been a **new attribute name**, which [`index.md` §3](./index.md)
forbids. Two more values on a closed set costs nothing and answers the question.

**The HTTP path is instrumented in the controller, not in the service method.** `GetPayloadAsync`
— the WebSocket entry point — calls `GetClientSdkPayloadAsync` / `GetServerSdkPayloadAsync`
internally, so instrumenting those two methods would have **double-counted every streaming sync**.
Recording at the controller action keeps the WebSocket path recorded exactly once and adds the HTTP
path exactly once.

**A malformed end user on the HTTP client sync is `rejected`, not `failure`.** It is a client
defect, caught before any store read, and letting it inflate the server failure rate would make
`sync.payloads{outcome=failure}` useless as an alert.

**A payload whose size cannot be established without enumerating a lazy sequence records no size at
all.** Payload collections are typed `IEnumerable<T>`, so the count is taken with
`TryGetNonEnumeratedCount`; enumerating to count could re-run the sequence and change what the caller
observes. Recording a zero instead would be worse than recording nothing, because it is
indistinguishable from a genuinely empty sync — one of the failures this instrument exists to catch.

`sync.duration` is the signal for a slow bootstrap. A full sync reads the store and evaluates every
flag for the user, so it is the most expensive thing a client can ask the evaluation server to do,
and it happens on every reconnect — which means it is also the thing a reconnect storm amplifies.

### Evaluation (`EvaluationMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.evaluation.evaluations` | Flag evaluations, by reason and outcome | Counter\<long\> | `{evaluation}` | `outcome`, `reason` | `Evaluator` |
| `featbit.evaluation_server.evaluation.duration` | Time to evaluate one flag for one user | Histogram\<double\> | `ms` | `outcome`, `reason` | `Evaluator` |
| `featbit.evaluation_server.evaluation.malformed_entities` | Store entities that failed to parse during a sync | Counter\<long\> | `{entity}` | `resource_type` | `DataSyncService` |

`reason` is one of `archived`, `disabled`, `targeted`, `rule_match`, `fallthrough`,
`malformed_data`, or `error`.

**`reason` is derived from the variation's *type*, never from `UserVariation.MatchReason`.** For a
rollout, `MatchReason` is *the rule name the customer typed into the UI*. Tagging with it would
produce one time series per targeting rule in every environment on the installation, and would copy
customer-authored text into telemetry that leaves the process. `fallthrough` is told apart from
`rule_match` by comparing against the single sentinel value the product controls (`"default"`), which
is the only `MatchReason` that is not user-authored. `EvaluationMetricsTests` drives real flag JSON
through the real evaluator and asserts a deliberately hostile rule name never appears in the tags.

**The evaluator takes a zero-cost fast path when nothing is listening.** This is the hottest path in
the product — one call per flag per connected client per change — so `EvaluateAsync` checks
`EvaluationMetrics.Enabled` and delegates straight to the uninstrumented core without even reading a
timestamp.

`evaluation.malformed_entities` is emitted where a sync skips an entity it could not parse. That path
already logged, but a log line cannot answer "is this one bad flag or is the store corrupt?"; a
counter can.

### Store availability (`StoreMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.store.availability_checks` | Store availability probes, by outcome | Counter\<long\> | `{check}` | `provider`, `outcome` | `StoreAvailableSentinel` |
| `featbit.evaluation_server.store.availability_check_duration` | Duration of one availability probe | Histogram\<double\> | `ms` | `provider`, `outcome` | `StoreAvailableSentinel` |
| `featbit.evaluation_server.store.failovers` | Changes of selected store, tagged with the provider switched *to* | Counter\<long\> | `{failover}` | `provider` | `StoreAvailableSentinel` |
| `featbit.evaluation_server.store.no_store_available` | Probe cycles in which every store failed | Counter\<long\> | `{occurrence}` | *(none)* | `StoreAvailableSentinel` |
| `featbit.evaluation_server.store.selected` | 1 for the currently selected store, 0 for every other | ObservableGauge\<long\> | `{store}` | `provider` | `StoreAvailableSentinel` |

`store.selected` is **one 1/0 series per provider**, not a single gauge carrying the provider's name
as a value. This makes `sum by (provider)` answer "how many pods have failed over", which a string
value cannot.

`timeout` is a distinct outcome from `failure`: a store that is slow and a store that is refusing
connections are different faults with different causes and different remedies.

### Rate limiting (`RateLimitMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.rate_limit.decisions` | Rate-limit decisions, by outcome | Counter\<long\> | `{decision}` | `operation`, `outcome` | `RedisRateLimiter`, `RateLimiterRegister` |
| `featbit.evaluation_server.rate_limit.duration` | Time spent evaluating a rate-limit decision | Histogram\<double\> | `ms` | `operation`, `outcome` | `RedisRateLimiter` |

**Coverage is asymmetric, and this is documented rather than hidden.** `RedisRateLimiter` records
all outcomes (`success`, `rejected`, `fail_open`). The in-process limiters can only record
rejections, because ASP.NET Core's rate-limiting middleware exposes an `OnRejected` hook and no
corresponding "accepted" hook. `RateLimiterRegister.OnRejected` therefore records only when
`!useDistributed`, so the two paths can never double-count the same decision.

`fail_open` is recorded as a **distinct outcome, never as a normal allow**: a request allowed only
because Redis was unreachable is not the same event as a request that was genuinely under the limit,
and merging them would hide a total loss of rate limiting behind a healthy-looking allow rate.

### Agent registration (`AgentMetrics`)

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.evaluation_server.agent.registrations` | Relay-proxy agent registration attempts, by outcome | Counter\<long\> | `{registration}` | `outcome`, `reason` | `AgentController` |

`reason` is one of `registered`, `unauthorized`, `quota_exceeded`, or `error`.

**Quota exhaustion is the reason this instrument exists.** `CheckQuotaAsync` returning `false`
produces an HTTP 403 and nothing else: no exception, no error log, no failing health check. It is
working as designed, so nothing else in the estate would ever surface it — yet from the operator's
side the symptom is "the relay proxy never came up", which is indistinguishable from a bad key or a
crash without this counter to tell the three apart.

**The reason vocabulary is closed by construction.** `/agent/register` is `[AllowAnonymous]`, so any
attribute derived from the request would be an unbounded series mintable by an unauthenticated
caller. Every value is a compile-time constant on `AgentReasons`, and a test asserts by reflection
that the set stays small and stays fixed.

Plus the cross-service messaging, change-propagation, and worker/buffer instruments under the
`featbit.evaluation_server.` prefix, and `insights.received` and `insights.request_size` from
[Insights](#insights-insightsmetrics) above.

---

## Control plane — `FeatBit.ControlPlane`

| Instrument | Description | Type | Unit | Attributes | Emitted from |
| --- | --- | --- | --- | --- | --- |
| `featbit.control_plane.handler.suppressed_failures` | Handler failures caught and not rethrown, so the message was acknowledged | Counter\<long\> | `{failure}` | `operation`, `reason` | `ClientConnectionMadeHandler`, `ClientConnectionClosedHandler`, `HeartbeatMessageHandler` |
| `featbit.control_plane.cache.broadcast_operations` | Per-DC cache fan-out operations | Counter\<long\> | `{operation}` | `dc_id`, `operation`, `outcome` | `CompositeRedisCacheService.ExecuteSafelyAsync` |
| `featbit.control_plane.cache.broadcast_duration` | Duration of one per-DC cache fan-out operation | Histogram\<double\> | `ms` | `dc_id`, `operation`, `outcome` | as above |
| `featbit.control_plane.leader.transitions` | Leadership changes; steady state is zero | Counter\<long\> | `{transition}` | `reason` | `RedisLeaderElector` |
| `featbit.control_plane.pod_health.evictions` | ELS pods evicted for a stale heartbeat, plus unparseable pod ids skipped | Counter\<long\> | `{pod}` | `reason`, `outcome` | `PodHealthChecker` |
| `featbit.control_plane.recovery.dc_backfills` | Per-DC backfill attempts for a returning DC | Counter\<long\> | `{backfill}` | `dc_id`, `outcome` | `RecoveryWorker` |
| `featbit.control_plane.request.total` | MediatR requests by request type and outcome | Counter\<long\> | `{request}` | `operation`, `outcome` | `ObservabilityBehaviour` |
| `featbit.control_plane.request.duration` | Duration of a MediatR request handler | Histogram\<double\> | `ms` | `operation`, `outcome` | `ObservabilityBehaviour` |

Plus the cross-service messaging, change-propagation, and worker/buffer instruments under the
`featbit.control_plane.` prefix.

`request.total` and `request.duration` are the same instruments as the API server's, described under
[Requests](#requests-requestmetrics) above, emitted here because the control plane builds its own
MediatR pipeline. They could not be added until `RequestMetrics` gained
a `Configure` — without it, control-plane commands would have published under `featbit.api.*` and
been attributed to the API server, which costs more during an incident than having no metric at all.

**`suppressed_failures` covers exactly the gap `messaging.consumed` cannot.** Each control-plane
handler owns one topic, so a handler that *throws* is already visible as
`messaging.consumed{outcome=failure}` — adding a per-handler outcome counter would only double-count
it. Four of the seven handlers (`FeatureFlagChangeMessageHandler`, `SegmentChangeMessageHandler`,
`SecretChangeMessageHandler`, `LicenseChangeMessageHandler`) log and rethrow, so they are already
covered. The three listed above catch the problem and return normally; the consumer sees a clean
return and records success, so those failures were invisible at every layer. This counter closes
that gap and nothing else. The swallow behavior itself is unchanged.

**`cache.broadcast_*` is tagged per DC because that is the failure mode.**
`CompositeRedisCacheService` deliberately continues when one DC's Redis fails so that one DC's outage
does not fail the others — which means a permanently unreachable DC produces no error anywhere in
the aggregate, and flag changes simply stop arriving there. `dc_id` is bounded by deployment
topology, so it stays within the cardinality budget.

The targeted-write overload records `success` only when the underlying call *accepted* the write,
not merely when it did not throw. A rejected write is a failed fan-out for that DC.

`leader.transitions{reason=error_demoted}` is distinct from `lost`: a Redis error forces the instance
to assume not-leader even though it may still hold the lease, so the cluster can transiently have no
acting leader at all. That is a different incident with a different cause. A Redis error while merely
*attempting* to acquire is not counted — nothing changed, and counting it would drown the real signal.

`pod_health.evictions{reason=invalid_pod_id}` is recorded with `outcome=failure` because such an
entry can **never** be evicted and accumulates in Redis indefinitely. A nonzero rate here is a leak,
not a skip.

`recovery.dc_backfills{outcome=coalesced}` means the work merged with a backfill already in flight
for that DC — that DC *is* being repaired, just not by this call. It must not be read as a failure.

---

## Spans

Custom spans are **gated and default to off** — see [`index.md` §8](./index.md#8-traces).
`Observability:Traces:Categories` selects which categories emit and
`Observability:Traces:SampleRatio` sets the sample ratio (the legacy `FEATBIT_TRACES_CATEGORIES`
and `FEATBIT_TRACES_SAMPLE_RATIO` variables still work). With no categories enabled, no span object
is ever constructed.

All spans are emitted from a single `ActivitySource` per service, named after the service
(`FeatBit.Api`, `FeatBit.EvaluationServer`, `FeatBit.ControlPlane`). Exporters and
`OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES` key on that name.

### Change propagation (`PropagationMetrics.StageScope`)

| Span name | Kind | Category | Attributes | Emitted from |
| --- | --- | --- | --- | --- |
| `flag.persist` | Internal | `flag_change` | `resource_type`, `stage`, `change_id`, `outcome` | API server |
| `flag.publish` | Internal | `flag_change` | `resource_type`, `stage`, `change_id`, `outcome` | API server |
| `flag.consume` | Internal | `flag_change` | `resource_type`, `stage`, `change_id`, `outcome` | ELS, control plane |
| `flag.relay` | Internal | `flag_change` | `resource_type`, `stage`, `change_id`, `outcome` | Control plane |
| `flag.fanout` | Internal | `flag_change` | `resource_type`, `stage`, `change_id`, `outcome`, `fanout.targeted`, `fanout.failed` | ELS |

`segment.*` spans use the same shape with `resource_type=segment`. The span name is
`{resource_type}.{stage}`, so the set is the cross product of the two attribute vocabularies rather
than a hand-maintained list.

Three rules this section exists to pin:

- **Exactly one `fanout` span per change**, carrying counts as attributes. One span per connection
  would produce thousands of spans for a single flag toggle and tell an operator nothing that the
  counts do not.
- **A scope disposed without an explicit outcome records `failure`.** Fail-closed, so a missing
  `Succeeded()` call cannot inflate the success rate.
- **The stages of one change form a single trace across services.** Every transport carries W3C
  trace context with the message, so the API, control-plane, and ELS stages are genuinely parented
  rather than merely correlated. `change_id` — derived identically on both sides — then identifies
  *which* change a stage belongs to when one trace carries several.

The control plane's `relay` stage currently rides the `flag_change` category rather than having one
of its own. That is deliberate: an operator debugging a stalled flag change wants the API,
control-plane, and ELS stages to appear together, and a separate category would make them
independently switchable and therefore easy to enable incompletely.

### Streaming handshake (`HandshakeTrace`)

| Span name | Kind | Category | Attributes | Emitted from |
| --- | --- | --- | --- | --- |
| `streaming.handshake` | Server | `streaming_handshake` | `connection_type`, `reason`, `outcome` | ELS `StreamingMiddleware` |

- **The span ends at the handshake, not at the disconnect.** A streaming connection lives for hours;
  a span open that long is useless for latency analysis and arrives far too late to help with the
  incident it belongs to. Connection lifetime is covered by
  `featbit.evaluation_server.streaming.connection_duration`, which is a metric and costs nothing to
  keep open.
- **Retention is decided at the end, not the beginning.** The span is created whenever the category
  is enabled, and `ActivityTraceFlags.Recorded` is set on the way out: always for a rejection,
  always for a handshake ≥ 1,000 ms, and otherwise only if the sample ratio rolls in. Head sampling
  would discard exactly the handshakes worth keeping.
- `connection_type` is normalized through the **same** `StreamingMetrics.Normalize` the metrics use.
  A span and a metric disagreeing about the connection type would be worse than having neither.

### Data sync (`TailSampledTrace`)

| Span name | Kind | Category | Attributes | Emitted from |
| --- | --- | --- | --- | --- |
| `streaming.sync` | Server | `sync` | `operation`, `connection_type`, `outcome`, `sync.items`, `error_type` | ELS `DataSyncService` |
| `sdk.sync` | Server | `sync` | `operation`, `connection_type`, `outcome`, `sync.items`, `error_type` | ELS `SdkController` |

A full sync reads the store, evaluates every flag for the user, and serializes the result — the most
expensive thing a client can ask the evaluation server to do, and it runs on every reconnect. The
metric says a sync was slow; the span says whether the time went to the store, the evaluator, or the
payload build.

Retained always on failure and at ≥ 1,000 ms, otherwise sampled. `operation` and `connection_type`
carry the **same bounded values as `SyncMetrics`**, so a span and a metric can be filtered with one
expression.

**`sdk.sync` is a distinct span name from `streaming.sync`, deliberately.** It covers the HTTP
polling endpoints, and reusing the streaming name would merge two transports with different failure
modes and different cost profiles under one name — and would be plainly untrue for a request that
never touches a WebSocket. Both share the `sync` category and the same slow threshold, so enabling
sync tracing covers both transports and the same slowness is judged the same way on either.

### Insights (`TailSampledTrace`)

| Span name | Kind | Category | Attributes | Emitted from |
| --- | --- | --- | --- | --- |
| `insights.ingest` | Internal | `insights` | `insights.received`, `insights.rejected`, `insights.published`, `outcome`, `reason` | ELS `InsightController` |
| `insights.flush` | Internal | `insights` | `insights.batch_size`, `outcome`, `error_type` | back-end `InsightsFlushWorker` |

**These are two traces, not one.** Ingest and flush are separated by the message queue, which carries
no trace context, so the two ends cannot currently be joined into a single trace.
That is stated here rather than faked: what the spans give you today is which *end* is slow or
failing, which — combined with the `insights.received` / `insights.persisted` counter gap — is enough
to localize data loss to a service.

`insights.ingest` retains a request in which **every** event was rejected, even though that is not a
failure and the endpoint is behaving as designed. It is retained because an SDK whose events are all
being discarded looks healthy from every other angle.

Retained always on failure, at ≥ 2,000 ms for ingest, and at ≥ 5,000 ms for flush.

### Background work (`TailSampledTrace`)

| Span name | Kind | Category | Attributes | Emitted from |
| --- | --- | --- | --- | --- |
| `schedule.apply` | Internal | `scheduled_work` | `outcome`, `error_type` | back-end `FlagScheduleWorker` |
| `webhook.attempt` | Client | `scheduled_work` | `http.response.status_code`, `outcome`, `reason` | back-end `WebhookSender` |

Low-frequency work, so span volume is negligible even at a sample ratio of 1 — but the category is
still off by default, in line with every other custom trace.

**Neither span carries an identifier for the thing it is acting on.** No schedule id, flag key, or
webhook URL: schedule and flag identifiers are unbounded, and a webhook URL is customer-supplied and
routinely carries a secret in its path or query. Both are already in the log line for the same
operation, which the span's `trace_id` correlates to.

`webhook.attempt` is one span per HTTP attempt, so a retried delivery produces several — which is the
point, since the shape of the retries is what distinguishes a flaky endpoint from a dead one.

### Messaging (`MessagingMetrics.PublishScope`)

| Span name | Kind | Category | Attributes | Emitted from |
| --- | --- | --- | --- | --- |
| `messaging.publish` | Producer | `messaging` | `provider`, `destination`, `outcome`, `reason` | all Kafka/Redis/Postgres producers, all three services |

The `messaging` category was previously defined and accepted by
`TraceGate` but checked by no production code, so enabling it silently did nothing. This span is
what makes it mean something.

The span lives inside `PublishScope`, which every MQ publish in all three services already funnels
through — so it covers all twelve call sites and cannot be forgotten by the thirteenth.

**The consume side is deliberately not duplicated.** The six consumers already start an ingress
activity covering the same work, and a second span around it would report the same duration twice
under two names.

`outcome` is `enqueued`, never `success`. Every transport is fire-and-forget, so the span can only
attest that the broker accepted the message — not that it was delivered.

### Ingress activities

Ingress activities (HTTP request, WebSocket handshake, MQ consume) are **not** gated by
`TraceGate`: they exist so that every log line has a `trace_id` even with no exporter configured.
They are created at `ActivitySamplingResult.PropagationData`, which allocates the ids without
recording the span. See [`index.md` §5](./index.md#5-correlation).

---

## Diagnostic health checks

---

Registered under the `Diagnostics` tag and surfaced only on `health/diagnostics`. **None of them
gates traffic** — see [`index.md` §9](./index.md#9-health-checks). Promoting any into readiness is
deliberately out of scope: a diagnostic check that flips readiness can pull healthy pods from
rotation on upgrade.

| Check | Module | Reports | I/O |
| --- | --- | --- | --- |
| `Kafka Consumer Group Progress` | back-end (MqProvider=Kafka only) | Committed offsets vs. high watermarks, per topic and total lag; never-committed partitions counted separately | Yes — OffsetFetch + ListOffsets, on a cached consumer that never joins the group |
| `Store Availability` | evaluation-server | Which `IDbStore` is serving, the priority order used, and whether the pod has failed over | None — reads the sentinel's last decision |
| `Control Plane Cross-DC` | control-plane | Per-DC Redis reachability and leader state | None — reads `IConnectionMultiplexer.IsConnected` |

Severity rules that carry meaning:

- **`Control Plane Cross-DC` is Unhealthy only when the LOCAL DC is unreachable.** A peer DC being
  down is `Degraded`, because the control plane is designed to keep serving through it — failing
  hard would escalate a single-DC outage into a control-plane outage.
- **`Store Availability` on a fallback store is `Degraded`, never Unhealthy.** The pod is still
  serving correctly; the finding is that it is doing so from a fallback, which nothing else surfaces.
- **`Store Availability` with no store yet reported is Unhealthy.** That state is genuinely unknown,
  and unknown must not read as healthy.

The evaluation server deliberately has **no** Kafka consumer-group check. `KafkaMessageConsumer`
mints a fresh `evaluation-server-{Guid}` group id on every process start, so its group has no
history to be behind on and reported lag would be meaninglessly near zero. The group-id churn is
itself the defect; a check that appears to measure progress but cannot is worse than
none, because it would be believed.

`health/startup` is tagged over the **same** set as readiness: the two ask the same question of the
same dependencies and differ only in how long the orchestrator waits, which is a probe-manifest
concern. The endpoint is inert until a manifest references it; `kubernetes/` manifests are not
modified here — see [`exporting.md` §7](./exporting.md).

The `health/diagnostics` response writer emits exception **type names only**, never messages. Driver
exception text routinely embeds connection strings and authentication principals, and this endpoint
exists to be read by humans.

---

## Known gaps: what is deliberately not measured

Everything in the registry above is implemented and emitting. This section records what is **not**,
so that a reader can tell a deliberate decision from an accidental omission — and so that a gap is
found by reading this page rather than during an incident.

This section exists because the omission happened once already: several instrument families were
designed, never built, and never recorded anywhere as outstanding, while the documentation claimed
otherwise. They were found only because someone happened to ask. The rule now is that **anything
designed and not built is recorded here before the work that was supposed to build it can be called
done.**

| Not measured | Status | Why, and what it would take |
|---|---|---|
| `buffer.bytes` on `UsageTracker` and the ELS Postgres channel | Not built | Shipped for `InsightsTracker` only. The other two are not alike: ELS's `PostgresMessageConsumer` holds `ChannelMessage(string, long)` — a channel name and a row id, **no payload** — so bytes would be a constant multiple of `buffer.items` and carry no information beyond it. `UsageTracker`'s `Channel<UsageRecord>` has no caller holding a serialized form, so measuring it would mean serializing purely for telemetry on the ingest path. For both, `buffer.items` and `buffer.capacity` already answer the question |
| `oldest_message.age` — MQ backlog | Not built | `messaging.backlog` ships (see [Backlog depth and the background sampler](#backlog-depth-and-the-background-sampler)), so *depth* is answered. Age is not: Redis lists expose no enqueue timestamp without reading the head element, Kafka's committed-offset arithmetic yields a message count rather than a time, and only the Postgres transport has an `enqueued_at` column to read. One transport out of three would give a series absent for reasons an operator cannot see from the metric, which is worse than a consistently absent one |
| `messaging.redelivered` under Kafka and Redis | Not built | Shipped for Postgres only, where the consumer's poll already increments `deliver_count` on every delivery and the count is readable with no behavior change. Under Kafka and Redis there is genuinely nothing to count — no retry or dead-letter path exists, both Kafka consumers `StoreOffset` in a `finally` regardless of outcome, and the Redis consumer pops before processing — so a message is delivered exactly once or not at all. The absent series means "not applicable to this provider", not zero |
| A single end-to-end trace across the message queue | **Built**, with one residual | All three transports carry W3C trace context, so change propagation and data sync join into one trace across every service boundary — Kafka in message headers, Postgres in the `queue_messages.trace_parent`/`.trace_state` columns, Redis as sibling properties on the JSON payload. The control plane inherits this automatically, since it registers the back-end's producers and consumers rather than having its own. **The residual is `insights.ingest` and `insights.flush`**, which remain *two traces, not a parent/child pair*, under every transport: they are separated by a buffer and a flush cycle, not just by the queue, so no wire-level propagation can join them. Note also that the Postgres carrier requires `v6.0.0.sql` to have been applied — until it is, the producer's insert fails and is swallowed |
| Evaluation batch size | Not applicable | `/api/public/featureflag/evaluate` evaluates the flags of one environment for one end user; there is no caller-supplied batch to size. `sync.payload_items` already carries the count where a count exists |

### Instruments you might expect but will not find

Both of these measure something real — it is just recorded somewhere other than where a reader might
first look. They are listed so that a missing name is not mistaken for a missing signal.

| You might look for | Where it actually is | Why |
|---|---|---|
| A streaming *validation* counter | `streaming.upgrades{outcome="rejected",reason=...}` | A validation failure **is** a rejected upgrade. Two instruments counting one event would double-report it and invite the two to disagree |
| Family-specific outcomes such as `accepted`, `invalid`, or `publish_failed` | The estate-wide `success` / `rejected` / `failure` vocabulary | Defined once in [`index.md` §3](./index.md). A per-family outcome set would mean every dashboard has to know which family it is querying |

### Related work that is out of scope here

Signal **export** is wired and verified. Two deployment-specific pieces are deliberately not
shipped, because they are choices that depend on the operator's backend rather than on FeatBit:
**dashboards** and **alert rules**. [`exporting.md` §7](./exporting.md) tracks both.

The `kubernetes/` manifests are **not** in that category — they are wired, and the detail is in
[`exporting.md` §7](./exporting.md). All five service deployments under
`kubernetes/standard/application/` and `kubernetes/pro/application/` carry `ENABLE_OPENTELEMETRY`,
`OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_PROTOCOL`, with the gate
set to `"false"` so that applying them changes nothing until an operator deploys a collector and
flips it. `livenessProbe` and `readinessProbe` are wired against `health/liveness` and
`health/readiness`. What remains unwired there is narrower than "the manifests": no probe references
`health/startup` or `health/diagnostics`.

## Migration: pre-standard → standard

The seven control-plane instruments and the one ELS instrument predate this standard. They were
renamed and re-tagged in a single change so the estate obeys one convention, and so that newly
added instruments are not written against a convention already known to be wrong.

**This was a breaking change for metric consumers.** It was taken deliberately and early: at the
time of the change `OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES` was unset repo-wide, so none of
these instruments were exported and no dashboard or alert consumed them. The cost of the rename
only rises once export is configured.

Three changes were applied:

1. The `featbit.` prefix was added, per [`index.md` §2](./index.md#2-instrument-naming).
2. Unit suffixes were removed from instrument names — the unit belongs in the `unit` field.
3. Attributes banned by [`index.md` §4](./index.md#4-cardinality-budget) were removed.

| Previous name | Current name | Attribute change |
| --- | --- | --- |
| `control_plane.consistency.commits` | `featbit.control_plane.consistency.commits` | **`env_id` removed** |
| `control_plane.consistency.evicted_commits` | `featbit.control_plane.consistency.evicted_commits` | — |
| `control_plane.consistency.time_to_commit_ms` | `featbit.control_plane.consistency.time_to_commit` | — |
| `control_plane.consistency.pending_backlog` | `featbit.control_plane.consistency.pending_backlog` | — |
| `control_plane.consistency.applied_watermark_lag_ms` | `featbit.control_plane.consistency.applied_watermark_lag` | **`env_id` removed — see semantic change below** |
| `control_plane.consistency.unmatched_dc_count` | `featbit.control_plane.consistency.unmatched_dc_count` | — |
| `control_plane.consistency.is_leader` | `featbit.control_plane.consistency.is_leader` | **`instance_id` removed** |
| `evaluation_server.consistency.heartbeat_staleness_seconds` | `featbit.evaluation_server.consistency.heartbeat_staleness` | — |

### Semantic change: `applied_watermark_lag`

This is the one entry above where the **reported value changed**, not merely its name and tags.

The gauge's backing snapshot is a list of `(dc_id, env_id, lag_ms)` rows. Removing `env_id` would
otherwise leave several measurements sharing an identical tag set, making the reported value
arbitrary — the failure mode described in
[`index.md` §4](./index.md#removing-an-attribute-is-not-always-a-free-operation).

The gauge therefore now reports the **maximum lag across environments, per `dc_id`**. This
preserves the operational question the metric exists to answer — *is any environment falling behind
in this data center?* — and is the correct choice for alerting, since a threshold on the worst case
still fires. Per-environment lag is no longer available as a metric; use logs or traces, which may
carry `env_id`.

### Attribute removals that were value-safe

- **`commits` / `env_id`** — counters sum, so the series merged cleanly with no value distortion.
  This removal also made the instrument *self-consistent*: `env_id` was only ever applied on the
  flag commit path and never on the segment path, so the attribute was already asymmetric.
- **`is_leader` / `instance_id`** — redundant with the OTel resource attribute
  `service.instance.id`, and exactly one elector is active per pod in a real deployment.
