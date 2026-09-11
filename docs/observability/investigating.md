# Investigating an incident, beginning to end

This is the operator runbook: how to get from *"something is wrong"* to *"here is the line of code
and the exact request that caused it"* using the signals FeatBit emits.

It assumes signals are reaching a backend — see [`exporting.md`](exporting.md). For what each
instrument means see [`instruments.md`](instruments.md); for the rules the signals obey see
[`index.md`](index.md).

---

## 1. The identifiers that stitch everything together

Five fields do all the work. Every one of them appears in more than one signal, which is what makes
a hop from metric to trace to log possible.

| Field | Where it appears | What it joins |
|---|---|---|
| `trace_id` | every log record, every span, the `x-trace-id` response header | **one request or message, end to end within a service** |
| `span_id` | every log record, every span | one *stage* of that request |
| `change_id` | flag-change logs and `flag.*` spans | every stage of one flag/segment change |
| `connection.id` | every ELS streaming log for one WebSocket | one client connection over its whole lifetime |
| `service.name` | resource attribute on all three signals | which service emitted it |

Two properties are worth knowing because they change how you search:

- **`trace_id` exists even when tracing is "off".** A propagation-only listener always runs, so log
  records are always correlatable. Turning custom spans on adds detail; it is not what makes
  correlation work.
- **`change_id` is derived, not generated.** It is a hash of the change's identity, so the producer
  and consumer compute the same value independently without the message carrying it. That is what
  lets you follow a flag change across a service boundary today, since `trace_id` does **not** yet
  cross the message queue.

---

## 2. Pick your entry point

**A user gave you a trace ID.** Every API response carries `x-trace-id`. Go straight to §3 step 3.

```
x-trace-id: 3fd1150bf71aaafbf9ed4a5dceaed9dd
```

**A metric moved.** Start at §3 step 1 — use the metric's attributes to narrow *which* traces to
look at, then pivot.

**You have a log line.** Read its `trace_id`, then fetch every other record with the same value.
That is usually the fastest single step in this whole document.

---

## 3. Worked example: "our SDKs cannot connect"

This is a real investigation against a running stack, reproduced verbatim.

### Step 1 — Confirm and characterize it with a metric

Metrics are cheap, always on, and carry a bounded attribute set, so they are the right place to
establish *what* and *how much*:

```
featbit_evaluation_server_streaming_upgrades_total{
    connection_type="client", outcome="rejected", reason="invalid_request"
} 4
```

Already this is more than "connections are failing". It is `client` SDKs, not relay proxies; the
outcome is a *rejection*, not a crash or a timeout; and the reason is `invalid_request` — the
request itself was malformed or its token did not validate — rather than `unavailable` (the store
could not be reached) or `error`. The full vocabulary is `StreamingReasons`: `unknown`, `accepted`,
`invalid_request`, `unavailable`, `client_closed`, `client_aborted`, `server_shutdown`, `error`.

What a metric cannot tell you is *which* request, or *whose* token. For that, pivot to a trace —
and the pivot works because the span carries **the same attribute vocabulary**:
`connection_type`, `outcome`, and `reason` mean the same things on both signals.

### Step 2 — Find a representative trace

Query your tracing backend for the span, filtering on the attributes the metric just gave you:

```
name = "streaming.handshake" AND outcome = "rejected" AND reason = "invalid_request"
```

`streaming.handshake` retains **all rejections** and only samples successes, precisely so that this
search returns something during an incident rather than being sampled away. Take the `trace_id`:

```
f4f648fc9a5fb8457cea42b35c686a45
```

### Step 3 — Read the trace

Two spans, in a parent/child relationship:

```
[featbit-els]  Microsoft.AspNetCore              span=7479b4d6485c8ff3  parent=(root)
    name = GET
      url.path                 = /streaming
      http.response.status_code = 101
      url.query                = ?type=Redacted&token=Redacted

[featbit-els]  FeatBit.EvaluationServer          span=1f6602a8a19c4b5d  parent=7479b4d6485c8ff3
    name = streaming.handshake
      connection_type = client
      outcome         = rejected
      reason          = invalid_request
```

The shape localizes the failure immediately: the HTTP layer succeeded — status `101`, the WebSocket
upgrade was accepted — and the rejection happened *inside* FeatBit's handshake, one layer in. A
network or ingress problem is now ruled out.

Note `url.query` is redacted here. That is the auto-instrumentation, not FeatBit; see
[`exporting.md` §5](exporting.md). The FeatBit log record in the next step is more informative.

### Step 4 — Fetch every log for that trace

```
trace_id = "f4f648fc9a5fb8457cea42b35c686a45"
```

```
[featbit-els] span=1f6602a8a19c4b5d  Warning
    Streaming request was rejected: ?type=client&token=tok_639744d9b50f0880.
    Reason: Invalid token: tok_639744d9b50f0880.

[featbit-els] span=7479b4d6485c8ff3  Information
    HTTP GET /streaming responded 101 in 0.3376 ms
```

**This is the answer.** The client presented a token that ELS does not recognize. The `span_id` on
each record tells you which stage produced it — the `Warning` came from the handshake span, the
request-summary line from the root HTTP span.

### Step 5 — Identify the client without leaking the credential

`tok_639744d9b50f0880` is a salted hash, not the token. It is still the most useful field in the
record:

- It is **stable**, so every log line from this client joins on it, across services and pods
  (provided `Observability__RedactionSalt` is identical everywhere — see [`exporting.md` §5](exporting.md)).
- Hashing the SDK key from your own configuration with the same salt tells you **which** SDK key it
  is, so you can name the misconfigured client.
- The query *shape* survives — `?type=client&token=…` — so you can see the caller did send a
  well-formed request, rather than omitting the parameter.

Root cause: a client is configured with a stale or wrong SDK key. Four attempts, all `client` type,
all the same token hash.

---

## 4. Following a flag change that did not reach clients

The same method, across more than one service. Flag propagation is instrumented as **stages**, so
the question is always *which stage is the last one that succeeded*.

Join on **`change_id`**. Under `MqProvider=Kafka` the two halves also share a `trace_id`, because
the producer writes a `traceparent` header the consumer adopts — so there the whole change is one
trace. Under Redis or Postgres no trace context crosses the queue, and `change_id` is the only join
that works. Using `change_id` first is therefore the method that works on every deployment.

**Before you start: which delivery path, and was the change scheduled?** Two things change which
signals are relevant, and both are cheap to check first.

*How does this client receive updates?* The stage chain below ends in **fan-out**, which is the
**streaming push** path. An SDK that polls `sdk/server/latest-all` or `sdk/client/latest-all` never
appears in `flag.fanout` at all — so reading `fanout.targeted = 0` as "nothing was subscribed" is
the wrong conclusion for a polling client. Tell the two apart before going further:

```
featbit_evaluation_server_streaming_active_sockets                     # streaming clients
featbit_evaluation_server_sync_payloads_total{operation="http_full"}   # polling clients
featbit_evaluation_server_sync_payloads_total{operation="http_patch"}
```

For a polling client the change is never *pushed*. It arrives on the client's next poll, so the
questions are whether the store was updated (stages `persist` → `consume` below) and whether the
client is still polling at all. The span to read is `sdk.sync`, not `flag.fanout`. An `operation` of
`rp_full` or `rp_patch` means the request arrived through a relay proxy, which adds a hop of its own.

*Was the change scheduled rather than immediate?* If so, nothing happens until the schedule fires,
and every stage below starts only from that moment:

```
featbit_api_schedule_applied_total{outcome="success"}
featbit_api_schedule_lag_milliseconds
```

`schedule.applied{outcome="failure"}` means the change was never applied — stop there, because
nothing retries a failed schedule. A high `schedule.lag` means it was applied late rather than lost.
Lag can never be below the worker's 45-second poll interval, so judge it against a multiple of that
rather than against zero.

**1. Find where the stage counts diverge.** Every stage increments the same counter with a
different `stage` attribute:

```
featbit_api_propagation_stages_total{resource_type="feature_flag", stage="persist", outcome="success"}
featbit_api_propagation_stages_total{resource_type="feature_flag", stage="publish", outcome="success"}
featbit_evaluation_server_propagation_stages_total{resource_type="feature_flag", stage="consume", outcome="success"}
featbit_evaluation_server_propagation_deliveries_total{resource_type="feature_flag", outcome="success"}
```

Read them in order. If `persist` and `publish` climb but `consume` does not, the change left the API
and never arrived — look at the message queue, not at ELS. If `consume` climbs but `deliveries` does
not, the change arrived and fan-out failed.

`featbit_api_propagation_stage_duration_milliseconds` (same attributes) answers "slow rather than
broken". Note the `_milliseconds` suffix: the Prometheus exporter appends the unit to histogram
names, so an instrument declared as `…stage_duration` with `unit: "ms"` is scraped as
`…stage_duration_milliseconds`.

**2. Enable the spans and take one example.** With `Observability__Traces__Categories=flag_change`,
each stage emits a span — `flag.persist`, `flag.publish`, `flag.consume`, `flag.relay`,
`flag.fanout` — all carrying `change_id`, `resource_type`, `stage`, and `outcome`.

`flag.fanout` is the one to read closely. It is a single aggregate span per change (never one per
connection) and carries:

```
fanout.targeted = <connections that should have received it>
fanout.failed   = <connections the push failed for>
```

`targeted = 0` means ELS believed no client was subscribed — a subscription problem, not a delivery
problem. `failed > 0` names it as a push problem.

**3. Join the logs across services.** Search every service for the `change_id` from the span. This
is the step that reaches across the queue hop, and it returns the API-side and ELS-side records for
the *same* change even under a transport where the two are in different traces.

> A shared segment fans out to one message per environment, so the consumer derives a
> per-environment `change_id` that differs from the producer's. This is intentional and documented
> in [`index.md` §5](index.md) — expect one producer-side id to correlate with several
> consumer-side ids.

**4. Check the change was not silently swallowed.** *This step applies only where the deployment
runs the control plane.* The control plane is **opt-in** — FeatBit runs fully without it — and on a
deployment that does not run it the series below simply does not exist. **Absent is not the same as
zero**, so confirm the control plane is actually deployed before reading anything into a missing
series.

Where it is deployed, three of its handlers catch and discard failures, so they look successful at
every other layer. They are the exception this counter exists for:

```
featbit_control_plane_handler_suppressed_failures_total{operation="…", reason="…"}
```

If this is non-zero, the message was received and dropped, and nothing else in the system will say
so.

---

## 5. More playbooks

Each of these starts from a question an operator actually asks, and names the one signal that
answers it. All of them exist because the answer was previously unobtainable without attaching a
debugger to production.

### "Are we losing insights data?"

Insights are ingested by the evaluation server and persisted by the API server, with a queue in
between. The two ends are instrumented separately on purpose, so a gap between them localizes the
loss:

```
featbit_evaluation_server_insights_received_total{outcome="success"}   # accepted at ingest
featbit_api_insights_persisted_total{outcome="success"}                # persisted
```

A sustained deficit means the loss is *between* them. Narrow it with
`featbit_evaluation_server_insights_received_total{outcome="rejected"}` (bad payloads — a client
problem, not yours), `{outcome="failure"}` (the publish to the queue failed), and
`featbit_api_buffer_items_dropped_total{buffer="insights"}`. A non-zero
`featbit_api_buffer_blocked_writers` means the tracker's channel is full and is applying
backpressure to the request thread.

> **These use the estate-wide `outcome` vocabulary, not an insights-specific one.** `success`,
> `rejected`, and `failure` mean accepted, invalid, and publish-failed respectively. A per-family
> vocabulary would mean every query has to know which family it is reading.

Enable the `insights` trace category for `insights.ingest` and `insights.flush` spans, which carry
batch sizes and, on the ingest side, the received-versus-rejected split for a single request.

`featbit_evaluation_server_insights_request_size_bytes` separates "one SDK is sending far too much
per request" from "many SDKs are each sending a normal amount" — identical on an event-count chart,
opposite remedies. It is read from `Content-Length`, so a chunked request contributes nothing to it
rather than contributing a misleading zero.

### "Is the message queue backing up?"

A healthy `consumed` rate and a queue filling faster than it drains look identical from the rate
counters alone. Depth is what separates them:

```
featbit_api_messaging_backlog{provider="…", destination="…"}
```

Read it together with the rate, not instead of it:

| Backlog | `messaging_consumed_total` rate | Reading |
| --- | --- | --- |
| Flat and low | Steady | Healthy — consumers keep up |
| Climbing | Steady | **Producers outpace consumers.** The consumer is working, just not fast enough |
| Climbing | Zero | **Consumers have stopped.** Check `featbit_<svc>_worker_running` and `worker_loop_failures` for the consumer worker |
| Flat | Zero | Idle, *or* nothing is being published — confirm with `messaging_published_total` before relaxing |
| **`-1`** | anything | **The sampler cannot reach the datastore.** Not a queue problem; see below |

**`-1` means unknown and never zero**, which matters more than it looks: a zero here would read as
"drained" at precisely the moment a broker is unreachable, which is the most expensive wrong answer
this gauge could give. If you see `-1`, the queue depth is not the finding — the probe failure is.
Confirm with:

```
featbit_<svc>_worker_last_success_age{worker="mq_backlog_sampler"}
featbit_<svc>_worker_loop_failures_total{worker="mq_backlog_sampler"}
```

A `last_success_age` that keeps climbing means every reading you are looking at is stale, regardless
of what the numbers say.

Two cases where an absent or `-1` series is expected rather than a fault:

- **Immediately after an evaluation-server restart.** It assigns itself a fresh Kafka consumer group
  per process, which has committed no offsets yet, so lag is genuinely unknown for the first cycle.
- **Any evaluation-server transport other than Kafka.** Its Postgres consumer uses `LISTEN`/`NOTIFY`
  and its Redis consumer uses pub/sub; neither has a queue to measure, so no series is registered at
  all. See
  [`instruments.md`](instruments.md#backlog-depth-and-the-background-sampler).

For Kafka, `health/diagnostics` reports the same lag through the same reader, so the endpoint and
the gauge cannot disagree — a useful cross-check when you suspect the metrics pipeline rather than
the queue.

### "Is evaluation behaving the way the flag is configured?"

```
featbit_evaluation_server_evaluation_evaluations_total{reason="…", outcome="…"}
featbit_evaluation_server_evaluation_duration_milliseconds
```

`reason` is the evaluation outcome class, from a fixed seven-value set: `archived`, `disabled`,
`targeted`, `rule_match`, `fallthrough`, `malformed_data`, `error`. A shift in its distribution
after a flag change is the fastest available signal that a targeting rule is not doing what its
author expected.

`featbit_evaluation_server_evaluation_malformed_entities_total{resource_type="flag"|"segment"}` is
the one to alert on: it means a stored entity failed to parse, which is a data problem that
otherwise surfaces only as clients silently receiving the default variation.

> **`reason` is deliberately *not* the rule name.** Rule names are authored by customers in the UI,
> so tagging them would make this metric's cardinality a function of how many rules your customers
> write. `rule_match` tells you a rule matched; *which* rule is a log-level question.

### "Why can't this SDK stay connected?"

Reconnect storms show up as sync volume rather than handshake failures, because each reconnect is a
*successful* handshake followed by a payload fetch:

```
featbit_evaluation_server_sync_payloads_total{operation="full"|"patch"|"http_full"|"http_patch", connection_type="…"}
featbit_evaluation_server_sync_duration_milliseconds
featbit_evaluation_server_sync_payload_items
```

A rising `full` share means clients are losing their position and re-downloading everything, which
is both a symptom and a cause of load. `connection_type` separates SDK clients from relay proxies,
which matters because one relay proxy's full sync is far larger than one client's.

**`operation` also tells you which transport the fleet is on.** `full` / `patch` / `rp_full` /
`rp_patch` come from the WebSocket path; `http_full` / `http_patch` come from the
`sdk/server/latest-all` and `sdk/client/latest-all` polling endpoints. Traffic moving from the
streaming values to the `http_*` values means SDKs are falling back to polling — usually because a
proxy, load balancer, or firewall is refusing the upgrade. That is invisible in the handshake
metrics, because those clients never attempt a handshake at all; the only trace of it is which
`operation` values are growing.

Enable the `sync` category for spans: `streaming.sync` for the WebSocket path and `sdk.sync` for the
HTTP one. Both carry `sync.items`.

Message sizes are the other half of this question, and they separate "many small messages" from "a
few enormous ones" — the same line on a message-count chart, with opposite remedies:

```
featbit_evaluation_server_streaming_received_message_size_bytes{operation="…", outcome="…"}
featbit_evaluation_server_streaming_sent_message_size_bytes{operation="…"}
```

A large `sent_message_size` on `data-sync` alongside a large `sync_payload_items` is a bootstrap
that has simply grown too big for the connection; a large `received_message_size` with
`outcome="rejected"` is a client sending something it should not.

### "Why did that relay proxy never come up?"

```
featbit_evaluation_server_agent_registrations_total{outcome="…", reason="…"}
```

Three failures look identical from the agent's side — it just never appears — and only `reason`
tells them apart: `unauthorized` (bad or missing relay-proxy key), `quota_exceeded` (the workspace
is at its agent limit), and `error` (registration threw). `quota_exceeded` is the one worth knowing
about, because it is *working as designed*: it returns HTTP 403 with no exception, no error log, and
no failing health check, so this counter is the only place it is visible at all.

### "Did the outbound call fail, or did we fail?"

```
featbit_api_dependency_requests_total{destination="…", outcome="…"}
featbit_api_dependency_duration_milliseconds{destination="…"}
```

`destination` is a logical name, never a URL, and comes from a closed set: `billing`, `agent`,
`oidc`, `oauth`, and `clickhouse`. This is the first thing to check when the API is slow but its own
database looks healthy — an unresponsive dependency presents as generic API latency at every other
layer.

Three of those destinations answer questions that used to be unanswerable from telemetry alone:

- **`oidc` / `oauth`** — "SSO is broken" almost always means the *provider* is timing out or
  returning 4xx, but the user-visible symptom is a failed login. Read this next to
  `featbit_api_auth_logins_total{outcome="rejected"}`: if the dependency is failing, the login
  failures are not FeatBit's.
- **`agent`** — relay proxy availability checks and bootstrap pushes. A relay proxy that never
  syncs shows up here as `outcome="failure"` or `timeout` before anyone notices stale flags at the
  edge. Note that `SyncToAgent` converts a failure into a returned result object rather than
  throwing, so this counter is the signal that the sync attempt failed at all.
- **`clickhouse`** — analytics queries. Slow dashboards with a healthy operational database point
  here.

For webhooks, `featbit_api_webhook_attempts_total` counts *attempts* while
`featbit_api_webhook_deliveries_total` counts deliveries, so a widening gap between them is retry
activity. Enable `scheduled_work` for `webhook.attempt` spans, which carry
`http.response.status_code`. The URL is not on the span — it is in the correlated log line, which
has a narrower audience.

`featbit_api_schedule_due` is a histogram of how many schedules each worker cycle found due. It
should sit at or near zero; a distribution that climbs across cycles means `FlagScheduleWorker` is
falling behind or failing, and `featbit_api_schedule_applied_total{outcome="failure"}` says which.
It is the leading indicator here — it moves before anything downstream notices a flag did not flip.

**When the complaint is "my 09:00 rollout went out at 09:40", read
`featbit_api_schedule_lag_milliseconds`.** It is the only instrument that measures *lateness*;
`schedule_apply_duration` measures how long the work took once it started, which is a different
number and is usually small even when the rollout was badly late. Two caveats when alerting on it:
lag is **never below the 45-second poll interval**, because that is how often the worker looks for
due schedules, so a threshold has to be a multiple of that rather than a small absolute number; and
negative samples are discarded rather than clamped, so clock skew between the writer and the worker
cannot drag the percentiles down and hide real lateness.

### Authentication: the one metric to read carefully

```
featbit_api_auth_logins_total{operation="password"|"oauth"|"oidc", outcome="…", reason="…"}
featbit_api_auth_authorization_decisions_total{resource_type="…", outcome="…", reason="…"}
featbit_api_auth_license_checks_total{operation="<feature>", outcome="…", reason="…"}
```

**A password failure always reports `reason="invalid_credentials"`, whether or not the account
exists.** That is deliberate: the HTTP response does not distinguish the two cases, because doing so
is a user-enumeration oracle, and a metric travels further than a response body. Do not read this
metric as evidence that an account exists. A test asserts that no `AuthReasons` value can serve as
that oracle, so it cannot regress.

A spike in authorization denials with `reason="not_licensed"` is a licensing problem presenting as a
permissions problem, and is worth checking before anyone starts debugging role assignments.
`reason="unmapped_permission"` is different in kind — it means a permission string reached the
checker that it has no rule for, which is a FeatBit bug rather than a customer misconfiguration.

---

## 6. When correlation is missing

| Symptom | Cause | Fix |
|---|---|---|
| Log records have empty `Trace ID` / `Span ID` | The record was emitted outside any request — startup, or a background worker loop with no ingress activity | Expected. Correlate background work by `service.name` and worker name instead |
| No logs at all for a trace on `/health/*` | Health-endpoint request logging is deliberately at `Debug`, so orchestrator polling does not flood the log | Expected. Lower the level, or investigate using the span alone |
| `trace_id` present but stops at a service boundary | Trace context crosses the queue only under `MqProvider=Kafka`; Redis and Postgres carry none | Join on `change_id` instead — §4 |
| Hashed tokens do not match across pods | `Observability__RedactionSalt` differs, or is unset (random per process) | Set the same salt everywhere — [`exporting.md` §5](exporting.md) |
| `featbit_*` metrics absent, others present | `OTEL_DOTNET_AUTO_*_ADDITIONAL_SOURCES` misconfigured | [`exporting.md` §2](exporting.md) |
| `flag.*` spans absent | Custom traces are off by default | Set `Observability__Traces__Categories` |

---

## 7. Health endpoints as a first stop

Before mining signals, three endpoints on every service answer "is this thing well?" directly:

| Endpoint | Use |
|---|---|
| `/health/liveness` | Is the process up? |
| `/health/readiness` | Should it receive traffic? |
| `/health/startup` | Has it finished starting? |
| `/health/diagnostics` | **Detail-rich, non-gating.** Kafka consumer-group lag, ELS selected store, control-plane per-DC reachability and leader state |

`/health/diagnostics` is the one to reach for during an incident. It never gates traffic, so reading
it is always safe, and it reports exception **types only** — never messages or stack traces — so it
is safe to expose to an on-call dashboard.
