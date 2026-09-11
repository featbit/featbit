# FeatBit Observability Standard

> **Status: Ratified.** This document is the single source of truth for application-level
> observability across `modules/back-end` (API server), `modules/evaluation-server` (ELS), and
> `modules/control-plane`.
>
> It supersedes [`../proposals/otel-custom-metrics/`](../proposals/otel-custom-metrics/README.md).
> Everything that proposal called for is implemented, apart from a small number of deliberate
> exclusions — most notably that **insights ingest and flush are two separate traces rather than
> one**. That one is not a propagation gap: the queue carries trace context on every transport, but
> ingest and flush are separated by a buffer and a batch flush cycle, so one flush span covers many
> ingests and no single parent exists to attach it to. Each exclusion is listed with its reason in
> [Known gaps](./instruments.md#known-gaps-what-is-deliberately-not-measured). See also
> [§8](#8-traces) and [`instruments.md`](./instruments.md#spans).
>
> The instrument registry lives in [`instruments.md`](./instruments.md). **Every new instrument
> must be added to it in the same change that introduces it.**
>
> Two companion documents cover the operational side: [`exporting.md`](./exporting.md) for getting
> the signals out to a collector, and [`investigating.md`](./investigating.md) for using them to
> track an incident from symptom to root cause.

## 1. Scope and principles

This standard covers the three .NET services. It governs **what** telemetry is produced and **how**
it is shaped. It deliberately does **not** cover signal export — collector configuration, the
SDK-versus-profiler decision, `OTEL_DOTNET_AUTO_*_ADDITIONAL_SOURCES`, dashboards, alert rules, and
Kubernetes probe manifests. Export setup is documented separately in
[`exporting.md`](./exporting.md), and the incident workflow built on top of it in
[`investigating.md`](./investigating.md).

> **The Control Plane is optional, and nothing here requires it.** FeatBit runs fully without one —
> it is opt-in via `UseControlPlane` in the API and `ControlPlane:Enabled` in the Evaluation Server,
> both of which default to *off*. Where this document says "all three services", read it as *each
> service that is deployed*. Two consequences are worth stating plainly, because both look like
> faults and are not:
>
> - **No `featbit.control_plane.*` series will exist** in a deployment without a control plane. The
>   instruments are declared by the control-plane module, so a process that is not running cannot
>   emit them. Absence is the expected reading, not a broken exporter.
> - **The `messaging.backlog` gauge still lists the control-plane webhook topic** in the API. The
>   API subscribes to that topic unconditionally — long-standing behaviour that predates this work —
>   so the topic is watched whether or not a control plane fills it. The probe reports an empty or
>   unknown depth for it and neither errors nor logs. Under Kafka specifically, a topic that does not
>   exist is filtered out by error code and reported as `-1` (unknown); the reader sets
>   `AllowAutoCreateTopics = false`, so observing a topic never creates one.
>
> The Evaluation Server goes further and varies its *subscription* by configuration:
> `KafkaConsumerTopics.For(configuration)` adds the control-plane command topic only when
> `UseControlPlane()` is true, so the backlog gauge and the consumer always watch the same set.

Five principles, in priority order:

1. **Telemetry must never change application behavior.** Instrumentation is side-effect-free. If
   adding a signal requires changing control flow, error handling, or a wire format, the signal is
   wrong or the change belongs in a separate piece of work.
2. **Telemetry must never block a request, stream, or evaluation path.** Gauge callbacks read
   cached or atomic state only and perform no I/O. Anything requiring a query runs on a background
   sampler.
3. **Bounded cardinality is not negotiable.** An unbounded attribute turns one time series into
   millions and takes the metrics backend down with it. See §4.
4. **No credentials in any signal.** SDK secrets and tokens are hashed, never written raw. Other
   data — message payloads, query strings, client addresses — is deliberately logged in full,
   because it is what makes an incident diagnosable. See §7.
5. **If a failure is invisible, it does not exist.** Every swallowed exception, dropped message, and
   silently stopped worker must be counted, even when the surrounding behavior is left alone.

## 2. Instrument naming

```
featbit.<service>.<area>.<name>
```

| Segment | Values |
| --- | --- |
| `<service>` | `api`, `evaluation_server`, `control_plane` |
| `<area>` | The functional slice, e.g. `streaming`, `messaging`, `flag_change`, `store`, `buffer`, `worker`, `consistency`, `ratelimit` |
| `<name>` | The measured thing, `snake_case` |

Rules:

- **Never encode the unit in the name.** The unit belongs in the instrument's `unit` field. Write
  `featbit.control_plane.consistency.time_to_commit` with `unit: "ms"`, not `…time_to_commit_ms`.
- Counters are named for the thing counted, pluralized: `commits`, `messages`, `decisions`.
  Prefer an `outcome` attribute over separate `…_succeeded` / `…_failed` instruments.
- Gauges are named for the state they report: `pending_backlog`, `is_leader`, `active_sockets`.
- Histograms are named for what is distributed: `connection_duration`, `stage_duration`.

### Meter names

```
FeatBit.<Service>[.<Area>]
```

| Service | Meter |
| --- | --- |
| API server | `FeatBit.Api` |
| Evaluation server | `FeatBit.EvaluationServer` |
| Control plane | `FeatBit.ControlPlane` |

An optional `.<Area>` sub-scope is permitted where a slice benefits from being enabled or exported
independently. Two such meters already exist and are **retained**:
`FeatBit.ControlPlane.Consistency` and `FeatBit.EvaluationServer.Consistency`.

Meter names are deliberately stable. `OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES` is keyed on the
meter name, so renaming a meter invalidates deployed export configuration — a materially more
expensive break than renaming an instrument. Introduce a new meter rather than renaming one.

All meter and activity-source names are declared as constants in `modules/shared/Observability/`
(`FeatBitMeters`, `FeatBitActivitySources`) and referenced from there. Do not inline the literal.

### Units

Units follow **UCUM — the [Unified Code for Units of Measure](https://ucum.org/ucum)** — the
case-sensitive unit notation that OpenTelemetry's
[metric semantic conventions](https://opentelemetry.io/docs/specs/semconv/general/metrics/#instrument-units)
require. Case is meaningful and not stylistic: `s` is seconds but `S` is siemens, and `By` is bytes
but `b` is bits.

This is not a cosmetic convention, because backends parse the string. The Prometheus exporter
appends the unit to the metric name, turning `ms` into a `_milliseconds` suffix and `By` into
`_bytes`, so an instrument declared with the wrong unit silently mislabels every panel and alert
built on it.

Dimensionless counts have no UCUM unit. They are written as a **brace annotation** naming the thing
being counted, so `{message}` means "a count of messages" rather than a unit called "message".
Annotations are always singular.

| Measuring | Unit |
| --- | --- |
| Milliseconds | `ms` |
| Seconds | `s` |
| Bytes | `By` |
| A count of things | `{commit}`, `{item}`, `{message}`, `{connection}`, `{dc}`, `{leader}`, `{worker}`, `{writer}`, `{failure}` |

## 3. Attribute allowlist

Attributes on metrics are restricted to this finite set. Anything not listed requires an amendment
to this document.

| Attribute | Values |
| --- | --- |
| `outcome` | `success`, `failure`, `timeout`, `rejected`, `dropped`, `enqueued`, `fail_open` |
| `operation` | The operation name, from a fixed set per call site |
| `provider` | `postgres`, `mongodb`, `redis`, `kafka` |
| `destination` | The topic or queue name, from the fixed `Topics` constants, or a logical dependency name |
| `resource_type` | `flag`, `segment` |
| `connection_type` | `client`, `server`, `relay_proxy` |
| `direction` | `missing_lease`, `unknown_dc` |
| `dc_id` | The configured data-center identifier — bounded by deployment topology |
| `reason` | A close/rejection reason from a fixed enumeration |
| `error_type` | The exception type name — **never** the exception message |
| `worker` | Background-worker name — bounded by the number of worker types |
| `buffer` | Buffer name — bounded by the number of buffers |
| `stage` | A named stage within a pipeline, from a fixed set |

These names are available as constants on `ObservabilityTags`, and the `outcome` values on
`Outcomes`, in `modules/shared/Observability/`. Use the constants rather than string literals:
it keeps call sites consistent and lets tests check the cardinality rule mechanically against
`ObservabilityTags.Banned`.

**`outcome` has one vocabulary for the whole estate, and mapping onto it is not optional.** The
insights instruments were at one point specified with outcomes named
`{accepted, invalid, publish_failed}`; they emit `success`, `rejected`, and `failure` instead. A
per-family outcome vocabulary would mean every dashboard and alert has to know which family it is
querying, which is precisely the tax the allowlist exists to avoid. Where a mapping like this is
applied, record it in [`instruments.md`](./instruments.md) next to the affected table.

Two additions beyond `Outcomes` are permitted and are documented where they are emitted:
`validation_failed` and `cancelled` on `request.total`. Both exist so that client-driven outcomes
cannot inflate the server failure rate; neither may be reused elsewhere without an amendment here.

## 4. Cardinality budget

**Banned as metric attributes, without exception:**

`env_id` · `instance_id` · `workspace_id` · `organization_id` · flag keys · segment keys · user or
end-user identifiers · tokens or secrets · URLs · IP addresses · exception messages · raw payloads

The reasoning: environments and flags grow without bound as customers use the product, so they
cannot be time-series dimensions. `instance_id` is redundant — the OTel resource attribute
`service.instance.id` already identifies the pod, and gauges are reported per instance and
aggregated at query time.

This budget binds the **whole estate**, including instruments that predate this document. Where an
existing instrument carried a banned attribute it has been removed; see the migration table in
[`instruments.md`](./instruments.md).

When a banned dimension is genuinely needed for diagnosis, the answer is a **trace attribute or a
log field**, not a metric attribute. Traces and logs are sampled and indexed differently and can
carry high-cardinality context safely.

### Removing an attribute is not always a free operation

Dropping an attribute from a **counter** is safe: the series merge and increments sum correctly.

Dropping an attribute from an **observable gauge** whose callback reports multiple rows is **not**
safe. If the backing snapshot holds one row per removed dimension, collapsing them leaves several
measurements sharing an identical tag set and the reported value becomes arbitrary. Such a change
requires an explicit aggregation decision (typically `max`, to preserve worst-case alerting), and
that decision must be recorded in `instruments.md` as a semantic change.

## 5. Correlation

Canonical field names, used identically in logs and span attributes:

| Field | Meaning |
| --- | --- |
| `trace_id` / `span_id` | W3C trace context, from `Activity.Current` |
| `change_id` | Identifies one flag or segment change as it moves between stages |
| `connection.id` | Identifies one WebSocket connection for its lifetime |
| `dc_id` | Data-center identifier |
| `env_id` | Environment identifier — permitted in **logs and traces only**, never on a metric |

Requirements:

- A root activity is created at every ingress: HTTP request, WebSocket handshake, and MQ consume.
- `trace_id` and `span_id` are enriched into **every** Serilog sink, including console — not only
  the OTLP sink.
- An always-on `ActivityListener` sampling at `ActivitySamplingResult.PropagationData` guarantees
  that a valid trace ID exists for logs even when no exporter is attached and no span is recorded.
- Metrics are recorded inside the active activity so that exemplars link metrics to traces once an
  exporter is configured.

### The correlation listener

`ActivityCorrelation.EnsureListener()` is called from `RegisterServices` in all three services.
Without it `Activity.Current` is always `null`, every trace ID is empty, and **no log can be
correlated to any other** — which was the state of the estate before this listener existed.

Two properties make it safe to leave on permanently:

- **It cannot suppress real tracing.** When several listeners observe one source the *highest*
  sampling result wins, so an exporter asking for `AllDataAndRecorded` still gets it.
- **It records nothing.** `PropagationData` creates the activity and its W3C identifiers but
  collects no tags, events, or timings.

Its scope is deliberately narrow — sources named `FeatBit*` and `Microsoft.AspNetCore*` only.
Listening to every source would switch on activity creation inside the HTTP, SQL, and Redis client
libraries, which sit on hot paths, for no correlation benefit the request-level activity does not
already give.

Where a value is unavailable the field is **omitted, never written empty**. An all-zero trace ID
reads as a real value when querying logs; a missing field is unambiguous.

### `change_id` is derived, not generated

`ChangeId.For(resourceType, envId, key, version)` returns a truncated SHA-256 of the change's natural
identity. Every service that receives a flag or segment change already holds those fields, so each
derives the same identifier independently — **no envelope, no wire-format change, and no lockstep
producer/consumer upgrade**. `ChangeId.FromJson` derives the same value from a consumed message.

Two consequences worth knowing before relying on it:

- Producer and consumer agree for **flag changes** and **environment-specific segment changes**.
- A **shared segment** fans out to one message per environment, each with `envId` rewritten to the
  target environment, so the consumer derives a *per-environment* identifier that differs from the
  producer's. That is the more precise value, and it still correlates the stages handling that
  fan-out. This is pinned by test, not left to chance.

Because the two module copies of `ChangeId` must agree byte-for-byte, both assert the same
golden value (`2cf611a893f3049b`) for a fixed input. If either copy's hashing, field order, or
separator drifts, that test fails rather than correlation silently breaking in production.

**What it is for now that trace context crosses the queue.** `change_id` used to be described as the
join that worked where tracing did not. That is no longer its job, and it never really was a
wider-coverage fallback: `ActivityCorrelation.SetChangeId` is a no-op when `Activity.Current` is
null, so it has exactly the same availability constraint as trace propagation. Its real value is the
one `trace_id` cannot supply — **which** logical change a span or log line belongs to when a single
trace carries several, as with a bulk flag update or a shared segment fanning out to one message per
environment. Join on `trace_id` to follow the request; filter on `change_id` to isolate one change
within it.

### Trace ID response header

API responses carry the trace ID in an `x-trace-id` header, so a user reporting a problem can quote
an identifier that leads straight to the server-side records. It is set from an `OnStarting` callback
registered by the first middleware in the pipeline, so failed responses carry it too.

**Header only.** Error response *bodies* are part of the API contract and are unchanged.

### Trace context across the message queue

**Every transport carries it.** The producer writes the W3C `traceparent` (and `tracestate`) with
the message, and the consumer adopts it as the ingress activity's parent, so a flag change is **one
trace end to end** across services under `MqProvider=Kafka`, `Redis`, or `Postgres` alike. Only the
carrier differs:

| Transport | Carrier |
|---|---|
| Kafka | Message headers |
| Postgres | `queue_messages.trace_parent` / `.trace_state` columns |
| Redis | Two sibling properties on the JSON payload, written by `JsonTraceContext` |

Three properties make this safe, and they hold for all three carriers:

- **Ignorable in both directions.** An old consumer skips a header, column, or JSON property it does
  not know; a new consumer treats an absent value as "no parent" and starts a root span, exactly as
  before. So producers and consumers can be upgraded in any order.
- **The message stays readable by anything that read it before.** Redis gets *sibling properties*,
  never an envelope — every handler in the estate reads the payload by property name and
  `System.Text.Json` ignores unknown properties, so nothing that parses these messages trips over
  them. Postgres adds columns nothing else selects.
- **A malformed value degrades to a root span**, never to an exception on the consume path.
  Instrumentation must not be able to stop message delivery.

**The control plane is included automatically**, on all three transports: it has no MQ
implementations of its own and registers the back-end's producers and consumers, so the
API → control plane → evaluation server chain joins as one trace tree.

> **One deployment ordering requirement, and it is not in the code.** The Postgres columns must
> exist before a producer that names them starts writing. Apply
> `infra/postgresql/docker-entrypoint-initdb.d/v6.0.0.sql` **before** rolling out the new image —
> scripts there only run automatically on an empty data directory, so an existing database needs it
> applied by hand. Getting the order wrong was tested rather than reasoned about, and the symptom is
> deceptive: the API still returns **HTTP 200** and still persists the change, because a publish
> failure is swallowed and logged, so the caller is told it worked while nothing is enqueued. The
> producer emits one line; the *consumer* is far louder, retrying in a loop with
> `42703: column qm.trace_parent does not exist`, which is what you will actually notice first.

**When the control plane is in the path, the evaluation server's span parents to the *control
plane's* publish span rather than the API's.** This is true on **all three transports** — confirmed
live on each — and it is the correct shape rather than a limitation: the control plane consumes the
API's message and republishes a *new* one, so it genuinely is the publisher of the message the
evaluation server received. The result is still a single tree rooted at the original HTTP request,
`API → control plane → evaluation server`.

One Redis-only exception runs in the opposite direction. Because the carrier there is a property
*inside* the payload rather than a header or a column, a control-plane handler that forwards the
payload verbatim leaves the API's original `traceparent` in place — `JsonTraceContext.Inject` returns
the string unchanged when it already contains one — so the evaluation server parents straight to the
API. Handlers that deserialize into typed objects and re-serialize, which the flag-change path does,
do not preserve it.

**On Kafka, the client library adds spans of its own.** `Confluent.Kafka`'s built-in instrumentation
emits an extra `<topic> receive` span per consumed message which is a **root** — no parent — and
carries a **span link** back to the producer, sitting alongside FeatBit's own `mq.consume` span.
Confirmed live: one control-plane round trip produced 52 link-bearing spans under Kafka and **zero**
under Redis or Postgres. These are *additional* spans, not replacements — FeatBit's `mq.consume`
still parents directly to the producing span, and the API → control plane → evaluation server chain
joins normally. Two consequences when reading a Kafka trace: expect **several roots sharing one
trace id**, and do **not** read the presence of links as evidence that propagation degraded to
linkage. On Redis and Postgres a link is genuinely anomalous; on Kafka it is routine.

## 6. Logging

- **Use source-generated logging.** Every log event in `back-end`, `evaluation-server`, and
  `control-plane` production code is declared with `[LoggerMessage]`. **There are no raw
  `logger.LogInformation(...)` / `LogWarning` / `LogError` / `LogDebug` / `LogTrace` /
  `LogCritical` calls left in any of the three `src/` trees, and none may be added.** The exact
  shape is specified in §6.1 below.
- **Log levels:**

  | Level | Use for |
  | --- | --- |
  | `Critical` | The process cannot continue or is serving wrong results |
  | `Error` | An operation failed and was not recovered; requires a human eventually |
  | `Warning` | Degraded but handled — retry, failover, fail-open, drop |
  | `Information` | Lifecycle and state transitions; low volume, never per-message or per-evaluation |
  | `Debug` | Per-message and per-operation detail; off in production |
  | `Trace` | Developer-only |

- **Always log the exception object**, never only `ex.Message`, so the stack trace survives.
- **A swallowed exception must still be logged and counted.**
- Request logging (`UseSerilogRequestLogging`) is enabled on all three services. `/health` is logged
  at `Debug` so that orchestrator polling does not flood the log, and a `5xx` or an unhandled
  exception is raised to `Error`.
- **The API exception handler logs every exception it converts into a response.** Client-caused
  failures (validation, not-found, conflict, forbidden, business rule) log at `Warning`; anything
  else logs at `Error`. Validation failures log error **codes** only, never the offending values,
  which are user input.

### 6.1 The `[LoggerMessage]` standard

This is the whole convention. It is mechanical on purpose — there is no judgment call to make, so
no two files can diverge.

**1. One sibling `<ClassName>.Log.cs` file per class that logs.** Never inline the `Log` class into
the type's own file, even for a single call site. The sibling lives next to the class, in the same
namespace, and re-declares the type as `partial`:

```csharp
// DcIdConsistencyChecker.Log.cs
using Domain.Observability;

namespace Api.Application.ControlPlane;

public sealed partial class DcIdConsistencyChecker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Information,
            "DcId consistency checker disabled (consistency mode is not GatedCommit).",
            EventName = "DcIdConsistencyCheckerDisabled")]
        public static partial void Disabled(ILogger logger);
    }
}
```

Call it as `Log.Disabled(_logger);`. A uniform rule beats a size threshold: inlining means editing
class bodies that variously use primary constructors, tabs, records, and static classes, which is
where mistakes happen.

**1b. The one sanctioned exception: a cross-cutting logging class gets its own file, named for
itself.** When a set of log events is called from *many* unrelated types rather than owned by one,
it is declared as a standalone `static partial class` of `ILogger` extension methods in its own
file. There is exactly one of these —
`evaluation-server/src/Streaming/StreamingLoggingExtensions.cs` — and it is also the reference
implementation for the redaction wrapper in §7. It obeys the point of rule 1 (logging declarations
live in a dedicated file, never inlined into a type that does other work) while not being the
sibling of any single class, because it has no single owner. Do not create more of these without a
genuine cross-cutting caller set; the sibling file is the default.

**2. Positional attribute arguments, with a named `EventName`.**
`[LoggerMessage(<id>, LogLevel.<Level>, "<template>", EventName = "<Name>")]`. Positional is the
repo-wide standard by a wide margin — 237 declarations to 9. Do **not** write
`[LoggerMessage(EventId = 1, Level = ..., Message = ...)]`.

The 9 named-form declarations are all in
`evaluation-server/src/Streaming/Messages/MessageDispatcher.Log.cs`, which pairs named form with
`[TagProvider]` parameter attributes. They are **left alone deliberately**: they are the oldest
`[LoggerMessage]` declarations in the estate, and rule 4 means their `EventId` and `EventName`
values must not move. Treat that file as frozen rather than as a precedent.

**3. Event IDs start at `1` within each owning class and are contiguous.** Each class has its own
independent sequence — ids are *not* unique across the assembly and are not meant to be. If a class
already has a `.Log.cs`, append from the highest existing id plus one.

**4. Preserve `EventId` and `EventName` on an event that already exists.** Log-based alerting keys
on them, so changing one silently breaks an alert. Renaming a *method* is free; renaming its
`EventName` is a breaking change and belongs in the breaking-change register.

**5. Parameter types must match the original argument expression exactly. Never add `.ToString()`
to make a call compile.** This is the single rule most likely to be broken, because breaking it
compiles, renders identically, and is invisible in console output:

```csharp
// Guid Id — correct: the structured payload stays a Guid
public static partial void Applied(ILogger logger, Guid flagId);

// WRONG: compiles, renders the same, and silently degrades the payload to a string
// Log.Applied(logger, flag.Id.ToString());
```

The old `ILogger.Log*` API took `params object?[]`, so anything compiled; the source generator is
strongly typed and will reject a mismatch. Widen the parameter to the real type — `Guid`, `long`,
`double`, `DateTimeOffset`, `ErrorCode`, `object?` — rather than coercing the argument. Structured
log consumers query on these types, and no test asserts the payload type, so a coercion will not be
caught.

**6. Credential-bearing events use the private-`Core` + public-wrapper shape** described in §7. The
wrapper is the only public entry point, so logging the raw value is impossible rather than merely
discouraged.

**7. A static class may still log.** A nested `static partial class Log` inside a
`static partial class` compiles fine; just add `partial` to the outer declaration.

**8. Do not reword an existing message template without checking the tests.** Several tests assert
rendered log text or, in one case, the exact structured property set with
`Assert.Equivalent(strict: true)`. Migration is meant to be behavior-preserving down to the
rendered string.

**Enforced at build time — the raw-call rule only.** One part of this standard is checkable by a
compiler — *that no raw `ILogger.Log*` call survives* — and that part is not a convention you have
to remember; it is a build failure. The .NET analyzer rule **CA1848 ("Use the LoggerMessage
delegates")** is turned on as an **error** for production code, so a raw `ILogger.Log*` call does
not compile. CA1848 ships with the SDK analyzers but is disabled by default; it is switched on,
scoped to `src/` only, by
`.editorconfig` files that set `dotnet_diagnostic.CA1848.severity = error`. One lives at each
module's `src/` root — `modules/back-end/src/.editorconfig`,
`modules/evaluation-server/src/.editorconfig`, `modules/control-plane/src/.editorconfig` — and a
fourth at `modules/shared/.editorconfig` covers the shared production libraries
(`Observability`, `Observability.AspNetCore`). Test projects live outside `src/` and are
deliberately left alone so they can keep using `FakeLogger` and direct logging. A violation
therefore fails the module's build with a `CA1848` error rather than merely being frowned upon.

CA1848 checks exactly one thing: that logging goes through a `[LoggerMessage]` method instead of a
raw `ILogger.Log*` extension call.

**Enforced by test — the payload-coercion rule.** Rule 5 is the other machine-checked rule, and it
is checked by a test rather than by the compiler, because no compiler can see it: adding
`.ToString()` compiles cleanly and renders identically. `LoggerMessagePayloadGuard`, in
`modules/shared/Observability.TestKit`, parses a module's `src/` tree, locates `Log.*(...)`
invocations, and fails when any argument contains a `.ToString()` call. One test per module runs it,
so all three are covered: `LoggerMessagePayloadTests` in the back-end's and the evaluation server's
`Application.IntegrationTests/Observability/`, and in the control plane's
`Api.UnitTests/Observability/`.

Deliberate exceptions are declared as an explicit `LoggerMessageToStringAllowance` list — file,
method, argument, and reason — rather than being matched by a heuristic, so every exemption is
reviewable. The guard **also fails when a declared allowance stops being used**, which means
removing a coercion cannot leave a stale exemption behind that would silently permit the next one.
The control plane's list is empty; the back-end allows six (four billing request DTOs and two
`Confluent.Kafka.Error` values); the evaluation server allows two `RedisChannel` channel-name
conversions.

**Not machine-checked.** Nothing fails if you inline the `Log` class instead of using a sibling file
(rule 1), switch to named attribute arguments (rule 2), or skip or duplicate an event id
(rules 3–4). Those remain convention, caught only in review — do not read the gates above as
enforcing them.

**Secondary check.** As a quick manual sweep, this grep should still return zero hits under each
module's `src/`:

```sh
rg '\.(LogTrace|LogDebug|LogInformation|LogWarning|LogError|LogCritical)\s*\(' \
   modules/back-end/src modules/evaluation-server/src modules/control-plane/src modules/shared
```

Deliberately look-behind free, so it runs on a stock ripgrep without `--pcre2`. It matches any
raw `.LogXxx(` call; the generated methods are invoked as `Log.<Name>(...)` and so do not match.

## 7. Sensitive data

**Scope: credentials only.** Exactly one class of value is protected in signals:

- SDK secrets, streaming tokens, relay-proxy tokens, API keys, JWTs

Everything else is written **raw and in full** — message-queue payloads, query strings, client IP
addresses, webhook URLs. That content is what makes an incident diagnosable, and these signals are
operator-facing. Passwords and connection strings must never be logged by any path.

**Hash, do not drop.** A credential is replaced by a stable, salted hash so that the same value
correlates across log lines without the value itself being recoverable. Dropping the field entirely
destroys the ability to answer "was this the same caller?"; logging it raw hands anyone with log
access the ability to authenticate as that SDK client and read flag configuration.

Hashing is HMAC-SHA256 keyed by `FEATBIT_REDACTION_SALT`, truncated to 16 hex characters, prefixed
`tok_`. **Set that variable to the same strong random value on every pod of a deployment**, or
correlation is confined to a single process lifetime. An *unkeyed* digest would not protect a token
at all, since candidate values are cheap to enumerate.

### Redact at the logging method, not at the call site

Every log event that would otherwise carry a credential is declared as a **private**
source-generated method behind a **public wrapper that redacts first**:

```csharp
[LoggerMessage(5, LogLevel.Error, "Exception occurred while looking up secret token: {Token}.",
    EventName = "ErrorLookupSecretToken")]
private static partial void ErrorLookupSecretTokenCore(ILogger logger, string? token, Exception ex);

public static void ErrorLookupSecretToken(this ILogger logger, string? token, Exception ex)
    => ErrorLookupSecretTokenCore(logger, Redaction.Token(token), ex);
```

Redacting at each call site would hold only until the next caller forgot, and a credential leak that
depends on everyone remembering is a leak. This shape makes logging the raw value **impossible**
rather than merely discouraged, and it preserves the `EventId` and `EventName`.

### Closing the back doors

Two signals *contain* credentials even though the signal itself is not a credential. Logging them
naively would leak by the back door everything the rule above protects:

- **Query strings** carry the ELS streaming token as `?token=…`. `Redaction.QueryString` keeps every
  key and every ordinary value legible and hashes **only** the values of credential-bearing
  parameters. `IncludeQueryInRequestPath` is therefore `false` on all three services, with the query
  re-attached as a separate `QueryString` property.
- **`ConnectionMessage` carries the client's SDK secret** in a `secret` property, and it travels
  through the generic MQ producer/consumer logs as well as the control-plane connection handlers.
  `Redaction.HideCredentials` returns a payload unchanged except for the values of credential-named
  JSON properties, which are hashed in place.

Both use a **denylist** of credential-bearing names (`token`, `secret`, `authorization`, `apikey`,
`api_key`, matched as substrings so `clientToken` and `access_token` are covered). A denylist fails
open — a newly added credential parameter leaks until someone adds it here. That trade-off is
accepted deliberately: the alternative, redacting every value, is what this standard used to require
and it was rejected because it destroyed the diagnostic value of query strings and payloads. **When
adding a query parameter or message field that carries a credential, add its name to
`Redaction.CredentialNames`.**

### Specific rules

- **Message payloads:** logged in full. They carry flag rules, segment definitions, and end-user
  attributes — exactly what is needed to diagnose a malformed or unexpected message. Pass them
  through `Redaction.HideCredentials`, which returns the original string with no allocation after a
  few ordinal substring scans unless the payload actually contains a credential field.
- **Client IP addresses:** logged raw. The API and control plane attach the caller's address to
  every log event via `Enrich.WithClientIp`; ELS records it as the `connection.client.ip` tag, whose
  emission remains governed by the existing `TrackClientHostName` setting.
- **Webhook URLs:** logged raw, including query parameters.
- Helpers live in `modules/shared/Observability/Redaction.cs`.

### Testing

Redaction is asserted **negatively** — `Assert.DoesNotContain(rawValue, message)` — and expected
values are written as `Redaction.Token(x)` rather than a literal. Both properties matter: the
negative assertion fails if a raw value is ever reinstated, and the computed expectation survives
the per-process random salt used when `FEATBIT_REDACTION_SALT` is unset. Unredacted fields are
asserted **positively**, so a future change that reinstates blanket redaction fails the build rather
than silently degrading diagnosability.

## 8. Traces

- One `ActivitySource` per service, named `FeatBit.<Service>`, declared in
  `FeatBitActivitySources`.
- **Custom traces are gated and default to off**, via `TraceGate` (category switch plus sample
  ratio). The gate is checked **before** the span is created and before any attribute is
  constructed, so a disabled category costs almost nothing.
- Retain errors, rejections, and slow operations; sample successes.
- **Where the interesting cases are not knowable up front, decide retention at the end.** Create the
  span whenever the category is enabled, then set `ActivityTraceFlags.Recorded` on the way out — for
  every failure, for anything over the operation's slow threshold, and otherwise per the sample
  ratio. Head sampling a handshake discards exactly the handshakes worth keeping.
- Span attributes may carry higher-cardinality context than metrics (`env_id`, `flag_key`,
  `change_id`) but remain bound by §7.
- **A span must tag itself with the same normalized value its metric uses.** A span and a metric
  disagreeing about, say, `connection_type` is worse than having neither, because the disagreement
  is discovered mid-incident.

**Never create a span per evaluation, per message, per fanout connection, or per connection
lifetime.** Fanout emits exactly **one aggregate span per change**, carrying target, success, and
failure counts.

### Trace categories

Categories exist so that turning on flag-change tracing during an incident does not also switch on a
span for every message published. Every category below is genuinely checked by production code — a
category that enables nothing is worse than no category, because it looks like it worked.

| Category | What it enables |
| --- | --- |
| `flag_change` | `flag.persist` / `publish` / `consume` / `relay` / `fanout`, and the `segment.*` equivalents, across all three services |
| `streaming_handshake` | `streaming.handshake` in the evaluation server |
| `sync` | `streaming.sync` (WebSocket) and `sdk.sync` (HTTP polling) in the evaluation server |
| `insights` | `insights.ingest` (ELS) and `insights.flush` (back-end) |
| `scheduled_work` | `schedule.apply` and `webhook.attempt` in the API server |
| `messaging` | `messaging.publish` at every MQ producer in all three services |

`all` enables every category. See [§11](#11-configuration) for how to set them.

**Adding a category obliges you to wire it.** `TraceCategories.Messaging` was defined for two phases
before any production code checked it, so `Categories=messaging` silently enabled nothing and the
only thing referencing the constant was a test. If a category is not yet wired, do not define it.

Every span is registered in [`instruments.md`](./instruments.md#spans) with its name, kind,
category, and attributes, in the same change that introduces it.

## 9. Health checks

Four tags, with distinct contracts:

| Tag | Endpoint | Contract |
| --- | --- | --- |
| `Startup` | `health/startup` | Has the process finished initializing? Fails until ready, then passes forever. |
| `Readiness` | `health/readiness` | Should this instance receive traffic? **Only hard dependencies.** |
| `Liveness` | `health/liveness` | Is the process wedged beyond recovery? Failing it **restarts the pod**. |
| `Diagnostics` | `health/diagnostics` | Detail-rich operator information. **Never gates traffic.** |

Two rules that follow from the restart/rotation consequences:

- **A dependency that is not required to serve traffic must not be in readiness.** A peer
  data-center being unreachable must not remove an otherwise-healthy instance from rotation, or a
  single-DC outage escalates into a total outage.
- **A stalled worker must not fail liveness.** Restarting rarely fixes a stall and readily produces
  a restart loop. Report it via `Diagnostics` and a metric, and alert on it.

New detail-rich checks go to `Diagnostics` first. Promoting one into `Readiness` is a separate,
deliberate decision, because it can flip instances out of rotation on upgrade.

## 10. Testing requirements

Every new instrument ships with a test. The BCL provides everything needed; no new dependency is
required.

- Assert instrument **name, unit, and attributes** using `MeterListener`. Use the shared
  `MetricCollector` harness from `modules/shared/Observability.TestKit` (it subscribes by `Meter`
  *instance*, captures long/int/double, and can force observable-gauge collection); the control
  plane's integration tests additionally have `CounterCollector` / `HistogramCollector`.
- **Tests for a shared primitive belong in `modules/shared/Observability.Tests`, not in a module.**
  There is one implementation, so there should be one set of tests for it. That project is listed
  in all three solutions, so every module's workflow still fails when a primitive breaks. Tests for
  a *service-specific* instrument stay with that service.
- Assert the §4 cardinality rule: no banned attribute appears on any instrument.
- Assert spans with `ActivityListener`, including that a gated span is **absent** when its category
  is disabled.
- Assert redaction with `FakeLogger` (from `Microsoft.Extensions.Diagnostics.Testing`) by proving
  that credentials never reach log output — and, just as importantly, that non-credential data
  (payload contents, ordinary query parameters, client addresses) **does**, so a future change
  cannot quietly reinstate blanket redaction.
- Assert health-check **tag filtering**, so a `Diagnostics` check can never affect readiness.

Two hazards that cost real debugging time and are easy to repeat:

- **An `ActivityListener.ShouldListenTo` predicate must not read a static field that owns an
  `ActivitySource`.** The `ActivitySource` constructor notifies every registered listener, so a
  predicate reading `FeatBitActivitySources.Service` re-enters the type initializer while it is
  still running, sees a null field, and throws — producing a `TypeInitializationException` that
  poisons the type for the entire test process. Hoist the source *name* into a local before
  registering the listener and close over the string.
- **xUnit runs test classes in parallel.** Classes that touch process-wide state — a shared `Meter`,
  the global `ActivitySource`, `TraceGate.Current`, or a singleton listener — must share a
  `[CollectionDefinition(DisableParallelization = true)]`. Relaxing `Assert.Single` to "at least
  one" is not an acceptable substitute: it stops the assertion catching double-counts, which is one
  of the things it exists to catch.

## 11. Configuration

Observability settings are ordinary .NET configuration keys, so every source the host already
supports works: `appsettings.json`, `appsettings.{Environment}.json`, user secrets, command-line
arguments, and environment variables. They are applied by `ObservabilityConfiguration.Apply` as the
first statement of each service's `RegisterServices`.

| Key | Legacy variable | Default | Effect |
| --- | --- | --- | --- |
| `Observability:Traces:Categories` | `FEATBIT_TRACES_CATEGORIES` | *(unset — all custom tracing off)* | Comma-separated trace categories to enable, or `all`. Categories are listed in `TraceCategories`. |
| `Observability:Traces:SampleRatio` | `FEATBIT_TRACES_SAMPLE_RATIO` | `1.0` | Sample ratio, `0.0`–`1.0`, applied only to enabled categories. Out-of-range values are clamped; unparseable values fall back to the default. |
| `Observability:RedactionSalt` | `FEATBIT_REDACTION_SALT` | *(unset — random per process)* | HMAC salt for hashed credentials (§7). **Set this to a strong random value, identical across all pods**, to correlate a caller across instances and restarts. Left unset, hashing still works but correlation is confined to a single process lifetime. |
| `Observability:Messaging:BacklogSampleIntervalSeconds` | *(none)* | `30` | How often the message-queue backlog sampler queries Redis, Postgres, or Kafka for queue depth. Floored at 5 s. **`0` or negative disables sampling**, which is the supported way to opt out of the periodic query; an unparseable value falls back to the default rather than disabling. See [`instruments.md`](./instruments.md#backlog-depth-and-the-background-sampler). |

```jsonc
// appsettings.Development.json
{
  "Observability": {
    "Traces": { "Categories": "flag_change,streaming_handshake", "SampleRatio": 1.0 }
  }
}
```

Three rules govern how these are read:

1. **The structured key wins** when both it and the legacy variable are set.
2. **The legacy `FEATBIT_*` variables keep working**, so an existing deployment behaves identically
   after upgrading. They are read through `IConfiguration`, so they can also be placed in
   `appsettings.json` if that is more convenient.
3. **Absent means "leave it alone", not "disable it".** `TraceGate.Current` is already initialized
   from the environment at type load, so resolving an empty configuration to a disabled gate would
   silently switch off tracing for a deployment that had enabled it.

For the same reason, **no default value is written into any `appsettings.json`**. A key present with
a default value would out-rank the legacy environment variable and override it.

> **`Observability:RedactionSalt` must be applied before the first credential is hashed.** The salt
> is materialized lazily on first use and is then fixed for the process. Configuring it afterwards
> throws rather than being silently ignored, because a dropped salt would produce hashes that cannot
> be correlated across pods with nothing in the output to reveal it. Keep `Apply` first in
> `RegisterServices`.

`Observability:Traces:*` governs FeatBit's own spans only. It is deliberately separate from
`OTEL_TRACES_SAMPLER`, which also affects automatic HTTP and dependency traces and so cannot serve
as a category-level switch.

## 12. Shared primitives

The primitives live in **one place**, `modules/shared/`, referenced by all three modules:

| Project | Assembly | Referenced by |
| --- | --- | --- |
| `shared/Observability` | `FeatBit.Observability` | back-end `Domain`, evaluation-server `Domain` (and so, transitively, everything above them including the control plane) |
| `shared/Observability.AspNetCore` | `FeatBit.Observability.AspNetCore` | all three `Api` projects |
| `shared/Observability.TestKit` | `FeatBit.Observability.TestKit` | the observability test projects — never a runtime project |
| `shared/Observability.Tests` | `FeatBit.Observability.Tests` | listed in all three solutions |

`shared/Observability` contains:

| Type | Purpose |
| --- | --- |
| `FeatBitMeters`, `FeatBitInstruments` | Meter names and instrument-name prefixes, for **all three** services |
| `FeatBitActivitySources`, `TraceCategories` | Activity-source names and gate-able trace categories |
| `ObservabilityTags`, `Outcomes` | The §3 allowlist and §4 banned list as constants |
| `WorkerNames`, `BufferNames` | The estate-wide worker and buffer vocabularies |
| `ServiceMeter` | The service-wide `Meter`, named by each host at startup |
| `TraceGate` | The §8 category switch and sample ratio |
| `ActivityCorrelation`, `CorrelationFields` | The §5 listener and canonical correlation field names |
| `ChangeId` | Derived identifier for one flag/segment change (§5) |
| `IngressActivity` | Root activity for a consumed MQ message, optionally parented by an extracted upstream context |
| `TraceContextPropagation` | W3C `traceparent`/`tracestate` inject and extract, BCL-only — no propagator package |
| `WorkerLoop` | The `Task.Factory.StartNew(..., LongRunning, ...).Unwrap()` pattern for consumer loops, named so its fault-propagation is testable |
| `ObservableGaugeSnapshot<T>` | Volatile snapshot behind an observable gauge |
| `MessagingMetrics`, `PropagationMetrics` | The messaging and change-propagation instrument families |
| `InsightsMetrics` | The insights instrument family — emitted by two hosts |
| `RequestMetrics` | Per-request duration and outcome for both MediatR pipelines |
| `TailSampledTrace` | The §8 tail-retention span scope used by the sync, insights, scheduled-work, and `messaging.publish` spans |
| `WorkerObservability` | Worker running state, heartbeat age, last-success age, loop failures |
| `BufferObservability` | Buffer occupancy, capacity, drops, blocked writers, write wait |
| `Redaction` | Credential hashing, plus the two back-door guards of §7: credential-aware query-string and message-payload scrubbing |

Service-specific instruments stay with their service: `StreamingMetrics`, `StoreMetrics`,
`RateLimitMetrics`, `SyncMetrics`, `EvaluationMetrics`, `AgentMetrics`, and `HandshakeTrace` in
`evaluation-server/src/Domain/Observability/`; `AuthMetrics`, `WebhookMetrics`, `ScheduleMetrics`,
`StartupMetrics`, and `DependencyMetrics` in `back-end/src/Domain/Observability/`;
`ControlPlaneMetrics` in the control plane.

> **`back-end/src/Domain` is project-referenced by the control plane.** The five types listed there
> hardcode `FeatBitMeters.Api` because only the API server emits them today. If the control plane
> ever starts emitting one, it needs the same `Configure(meterName, instrumentPrefix)` treatment
> first — that omission is exactly what kept control-plane request metrics unbuilt for two phases.

`shared/Observability.AspNetCore` contains:

| Type | Purpose |
| --- | --- |
| `HealthCheckResponseWriter` | The §9 JSON writer for `health/diagnostics` |
| `ObservabilityConfiguration` | Applies the §11 settings to `TraceGate` and `Redaction`. Kept here rather than in `shared/Observability` so the Domain-level primitives stay free of a configuration dependency |

**Two deliberate naming decisions, both worth knowing before you go looking for them:**

- **The assembly is `FeatBit.Observability` but the namespace is `Domain.Observability`.** That
  mismatch is intentional. The namespace is what every call site in all three modules already used,
  so keeping it meant the shared project could be introduced without editing a single `using`
  directive. Two assemblies contributing to one namespace is legal C# and, here, is what made the
  move surgical instead of sweeping.
- **The constants for all three services live in one file each.** `FeatBitMeters` carries `Api`,
  `ControlPlane`, *and* `EvaluationServer`; `WorkerNames` carries every worker in the estate. One
  vocabulary in one place is the point — it is what makes a name collision a compile error and the
  §4 cardinality rule mechanically checkable across the whole estate, instead of three lists that
  drift apart.

**Per-service values are set at startup, not by which copy of a file you compile.** Each host calls
`ServiceMeter.Configure`, `MessagingMetrics.Configure`, `PropagationMetrics.Configure`,
`InsightsMetrics.Configure`, and `FeatBitActivitySources.ConfigureIngress` once in its
`ServicesRegister`, plus `RequestMetrics.Configure` in the two that build a MediatR pipeline. The
defaults baked into
those types (`FeatBit.Api` / `featbit.api.`) are only a pre-configuration fallback and are never
what a running service publishes under. **If you add a fourth host, configuring it is not optional**
— without those four calls its telemetry is silently attributed to the API server, which is the kind
of error only discovered halfway through an incident.

**The Docker build context for all three .NET images is `modules/`, not the module directory.** That
is the cost of a shared project, and it is the reason this was originally rejected — wrongly, as it
turned out: the control-plane image had already built this way for years, because it references
back-end projects. The consequence is that `modules/back-end/deploy/Dockerfile` and
`modules/evaluation-server/deploy/Dockerfile` use explicit per-project `COPY` lines rather than the
flattening `mv` loop they used before (a flattening wildcard would collide the shared projects with
the module's own), and `modules/.dockerignore` governs all three builds. Compose files, the
`publish-docker-images.yml` matrix, and the `e2e/control-plane` image scripts all pass
`context: ./modules`.

The primitives depend only on the base class library — `System.Diagnostics.Metrics` and
`System.Diagnostics` ship in the shared framework — so **no new NuGet dependency is required**, and
the instrumentation is export-agnostic: it works unchanged with the CLR-profiler auto-instrumentation
in place today or an in-process OTel SDK later. `shared/Observability.AspNetCore` is a separate
project purely to keep the ASP.NET Core framework reference out of the `Domain`-level primitives.

## 13. Adding an instrument — checklist

1. Does it answer a question you would actually ask during an incident? If not, do not add it.
2. Name it per §2; put the unit in the `unit` field, not the name.
3. Check every attribute against §3 and §4.
4. Confirm the emit path does no I/O and cannot block (§1).
5. Add a row to [`instruments.md`](./instruments.md).
6. Add a test per §10.
