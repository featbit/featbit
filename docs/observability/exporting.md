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

- **Cross-service trace context.** A trace stops at each service boundary; the message-queue hop
  does not carry `traceparent` yet. Each service's stages still stitch together internally, which
  localizes a stall to a service. See
  [Known gaps](instruments.md#known-gaps-what-is-deliberately-not-measured).
- **Dashboards and alerts.** No dashboard JSON or alert rules ship with FeatBit.
  [`instruments.md`](instruments.md) is the source list to build them from.
- **Kubernetes manifests.** The `kubernetes/` manifests do not set these variables; add them to
  your own deployment.
- **Queue depth.** There is no backlog sampler, so "is the queue backing up?" is answerable only by
  inference from consume rate. See
  [Known gaps](instruments.md#known-gaps-what-is-deliberately-not-measured).
