# Exporting FeatBit's signals

FeatBit's three .NET services — the API server, the Evaluation Server (ELS), and the Control Plane —
emit metrics, traces, and logs using only BCL primitives (`Meter`, `ActivitySource`, `ILogger`).
Producing a signal and *exporting* it are separate concerns: by default the signals are created
in-process and go nowhere.

This page covers getting them out to a collector. For the standard itself (naming, attributes,
cardinality) see [`index.md`](index.md); for the full instrument list see
[`instruments.md`](instruments.md); for how to use the signals during an incident see
[`investigating.md`](investigating.md).

---

## 1. The short version

Set these on each service and point them at your own collector:

```sh
ENABLE_OPENTELEMETRY=true
OTEL_SERVICE_NAME=featbit-api            # or featbit-els / featbit-control-plane
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc         # MUST match the port — see §3
```

That is the whole configuration. Everything else has a working default baked into the image.

A ready-to-run example lives at
[`docker/composes/docker-compose-otel.yml`](../../docker/composes/docker-compose-otel.yml), with a
minimal dependency-free collector config at
[`infra/otel/otel-collector-verify.yml`](../../infra/otel/otel-collector-verify.yml). Swap the
endpoint for your own collector and nothing else needs to change.

---

## 2. How export actually happens

Metrics and traces are exported by the **OpenTelemetry .NET automatic instrumentation** (a CLR
profiler), which `start.sh` installs and enables when `ENABLE_OPENTELEMETRY=true`. There is no
OpenTelemetry SDK package referenced by any service.

Logs take a different path: Serilog writes to an OTLP sink configured in each service's
`ConfigureSerilog.cs`. It reads the same `OTEL_EXPORTER_OTLP_ENDPOINT` and
`OTEL_EXPORTER_OTLP_PROTOCOL`, so one pair of variables configures all three signals.

`OTEL_SERVICE_NAME` is honored by both paths, so `service.name` agrees across metrics, traces, and
logs. If it is unset, each service falls back to its own literal (`featbit-api`, `featbit-els`,
`featbit-control-plane`).

### Custom instruments need to be named explicitly

The auto-instrumentation exports only the meters and activity sources it is told about. **Every
custom FeatBit instrument lives on a dedicated meter**, so without this the entire contents of
[`instruments.md`](instruments.md) is collected in-process and silently dropped — the built-in
ASP.NET Core and runtime metrics still arrive, which makes the loss easy to miss.

`start.sh` therefore defaults both of these:

```sh
OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES=FeatBit.Api,FeatBit.EvaluationServer,FeatBit.ControlPlane,FeatBit.EvaluationServer.Consistency,FeatBit.ControlPlane.Consistency
OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES=FeatBit.Api,FeatBit.EvaluationServer,FeatBit.ControlPlane,FeatBit.EvaluationServer.Consistency,FeatBit.ControlPlane.Consistency
```

All five names are listed on all three services deliberately. A source a process never creates
simply never matches, so one shared list keeps the three `start.sh` files identical. Both use
`${VAR:-default}`, so setting your own value overrides them — but if you do, **include the FeatBit
names**, or you will turn the custom instruments off.

For local (non-container) development, [`infra/otel/utils/otel-env-vars.ps1`](../../infra/otel/utils/otel-env-vars.ps1)
sets the same variables.

### Exemplars: the metric-to-trace pivot

An **exemplar** is a single concrete `trace_id`/`span_id` attached to a metric data point. It is what
turns "p99 latency spiked at 14:02" into "here is a trace of a request that was slow", without
guessing at a time window. All three `start.sh` files default:

```bash
export OTEL_METRICS_EXEMPLAR_FILTER=${OTEL_METRICS_EXEMPLAR_FILTER:-trace_based}
```

**The auto-instrumentation does not do this on its own.** Verified by running the same workload with
and without the variable: **0** exemplars across 215 FeatBit metric data points, against 48 carrying
one afterwards. Without it, metrics join to nothing — `trace_id` links logs to spans and `change_id`
links across async hops, but a metric points nowhere.

`trace_based` rather than `always_on` means an exemplar is attached only where a *recorded* span is
in scope, so there is always something to pivot to.

**This does not require FeatBit's own tracing to be on.** That is worth stating plainly, because the
opposite is easy to assume. With `Observability:Traces:Categories` unset, a measurement taken during
a request still lands inside the auto-instrumentation's ASP.NET Core server span — which, as §4
notes, is never gated — so the pivot resolves to the HTTP request. Verified: with FeatBit tracing
off, an exemplar on `featbit.api.propagation.stage_duration` resolved to the
`PUT .../feature-flags/{key}/toggle/{status}` server span. Enabling FeatBit categories only makes
the target finer-grained — from *"the PUT that did this"* to *"the persist stage of that PUT"*:

```
-> Name: featbit.api.propagation.stage_duration
   -> stage: Str(persist)      Sum: 51.940100
   Exemplars:
   Exemplar #0
        -> Trace ID: 680ff7deac28cf99ed730db01f7e7f7b
        -> Span ID:  45ad97c9b5d14c1b      <-- the flag.persist span in that trace
        -> Value:    51.940100
```

The cost is a trace id and a span id on data points recorded inside a live span. Set the variable to
`always_off` to opt out.

**One export trap.** Exemplars survive OTLP, which is how the evidence above was captured. They are
**not** carried by a plain Prometheus scrape — that requires OpenMetrics exposition
(`enable_open_metrics: true` on the collector's Prometheus exporter, and a scraper that requests it).
If your metrics reach Grafana via Prometheus and the exemplar pivot is missing, that is where it was
dropped, not at the service.

---

## 3. The protocol/port trap

This is the single most common way to end up with no data and no error.

| Port | Correct `OTEL_EXPORTER_OTLP_PROTOCOL` |
|---|---|
| `4317` | `grpc` |
| `4318` | `http/protobuf` |

Both exporters default to **`http/protobuf`**. Pointing `OTEL_EXPORTER_OTLP_ENDPOINT` at port
`4317` without also setting the protocol posts HTTP/protobuf at a gRPC listener, and the signals are
discarded **silently** — no exception, no log line, no failed health check.

Always set both variables together, and make them agree.

---

## 4. Custom spans are off by default

Metrics and logs are always on. Custom **traces** are gated, because span volume is the expensive
signal, and default to off:

```sh
Observability__Traces__Categories=all      # or a comma-separated subset of:
                                           #   flag_change, streaming_handshake, sync,
                                           #   insights, scheduled_work, messaging
Observability__Traces__SampleRatio=0.1     # optional, applies to sampled categories
```

| Category | Spans it enables |
| --- | --- |
| `flag_change` | `flag.*` / `segment.*` stage spans across all three services |
| `streaming_handshake` | `streaming.handshake` |
| `sync` | `streaming.sync` (WebSocket), `sdk.sync` (HTTP polling) |
| `insights` | `insights.ingest`, `insights.flush` |
| `scheduled_work` | `schedule.apply`, `webhook.attempt` |
| `messaging` | `messaging.publish` at every MQ producer |

**Retention is decided when a span ends, not when it starts.** Every category above always retains
failures and operations past a per-span slow threshold, regardless of `SampleRatio`; the ratio only
decides how many *healthy, fast* operations are kept. So `SampleRatio=0` is a meaningful setting —
it means "errors and outliers only", which is usually what you want left switched on.

`scheduled_work` and `messaging` are cheap to leave enabled: schedules run on a 45-second tick and a
publish span is one per message, both far below streaming or evaluation volume. `sync` is the one to
be careful with, because it fires on every client reconnect.

The gate is checked *before* span creation and attribute construction, so a disabled category costs
effectively nothing. See [`index.md` §8 and §11](index.md).

Note that the ASP.NET Core, HTTP-client, Redis, and MongoDB spans from the auto-instrumentation are
**not** gated by this — they arrive as soon as export is on. The gate governs only FeatBit's own
spans (`flag.*`, `streaming.handshake`).

---

## 5. Credentials in exported signals

FeatBit hashes credentials rather than dropping them, so a value stays correlatable without being
usable — see [`index.md` §7](index.md). A streaming token appears as `tok_639744d9b50f0880`.

**That policy governs FeatBit's own logs and spans. It does not govern the auto-instrumentation's
span attributes.**

The auto-instrumentation redacts query-string *values* on its ASP.NET Core spans by default, which
is why a span shows `url.query = ?type=Redacted&token=Redacted` while the corresponding FeatBit log
line shows `?type=client&token=tok_639744d9b50f0880` — the log form is deliberately more useful,
keeping the non-credential value legible while hashing the credential.

> **Do not set `OTEL_DOTNET_EXPERIMENTAL_ASPNETCORE_DISABLE_URL_QUERY_REDACTION=true`.**
> It has been verified to publish the **raw streaming token** to your tracing backend as
> `url.query = ?type=client&token=<the real token>`. FeatBit's redaction cannot prevent this,
> because the attribute is written by the auto-instrumentation before any FeatBit code runs.
> If you need legible query values on spans, prefer a collector `attributes` processor that
> rewrites `url.query` under your own control.

Set `Observability__RedactionSalt` to the **same value on every service and every replica**, or
hashes will not match across pods and correlation by hashed credential breaks. If it is unset, the
salt is random per process.

---

## 6. Verifying signals are arriving

Work outwards — a failure at step 1 makes steps 2 and 3 meaningless.

**1. Is the collector reachable and healthy?** The example config exposes a health endpoint:

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:13133/    # expect 200
```

**2. Are FeatBit's custom metrics arriving?** The example collector re-exposes everything it
receives for Prometheus scraping on `:8889`:

```sh
curl -s http://localhost:8889/metrics | grep -o '^featbit_[a-z_]*' | sort -u
```

Expect names such as `featbit_evaluation_server_streaming_upgrades_total`,
`featbit_api_worker_running`, `featbit_evaluation_server_store_selected`. **If you see
`http_server_*` and `process_*` but no `featbit_*`, the `ADDITIONAL_SOURCES` variables in §2 are
wrong** — that is the exact fingerprint of that mistake.

**3. Are traces and logs arriving?** With the `debug` exporter enabled, the collector prints each
batch. Confirm FeatBit's own activity sources appear as instrumentation scopes:

```sh
docker logs otel-collector | grep 'InstrumentationScope FeatBit'
```

Expect `InstrumentationScope FeatBit.Api` and `InstrumentationScope FeatBit.EvaluationServer`
alongside the `Microsoft.AspNetCore` and `MongoDB.Driver` scopes.

**4. Is correlation intact?** Every exported log record should carry populated `Trace ID` and
`Span ID` fields. If they are empty, see [`investigating.md`](investigating.md) §6.

---

## 7. What is not wired up here

- **Dashboards and alerts.** No dashboard JSON or alert rules ship with FeatBit.
  [`instruments.md`](instruments.md) is the source list to build them from.
- **Kubernetes manifests ship these variables, but disabled.** The five service deployments under
  `kubernetes/standard/application/` and `kubernetes/pro/application/` now carry
  `ENABLE_OPENTELEMETRY`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and
  `OTEL_EXPORTER_OTLP_PROTOCOL`, with the gate set to `"false"`. Applying them changes nothing until
  you deploy an OTLP collector, point `OTEL_EXPORTER_OTLP_ENDPOINT` at it, and flip
  `ENABLE_OPENTELEMETRY` to `"true"`. It is off by default on purpose: enabling it starts exporting
  roughly eighty custom instruments, which is an ingest-volume and cost decision for the deployment's
  owner rather than a default someone should inherit silently. The manifests wire `livenessProbe`
  and `readinessProbe` against `health/liveness` and `health/readiness`; no probe references
  `health/startup` or `health/diagnostics`, so wiring those is still yours to do.
- **Message age in the queue.** `featbit.<svc>.messaging.backlog` reports queue *depth* from a
  background sampler, but how long the oldest waiting message has been there is not measured. See
  [Backlog depth and the background sampler](instruments.md#backlog-depth-and-the-background-sampler).
