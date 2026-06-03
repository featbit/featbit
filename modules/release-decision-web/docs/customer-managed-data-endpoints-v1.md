# Customer Managed Data Endpoints — Schema v1

> The public contract between FeatBit's analysis engine and a customer-hosted
> HTTP endpoint that returns experiment statistics from the customer's own
> data warehouse.
>
> Every field below is part of a versioned API. Additive changes ship as
> `v1`; anything that removes/renames a field bumps to `v2`.

---

## 1. Why this exists

Today FeatBit can only analyse experiments whose flag-evaluation and metric
events live in FeatBit-managed ClickHouse. Most enterprise customers already
have their own warehouse (Snowflake, BigQuery, Databricks, in-house ClickHouse,
etc.) and don't want to dual-write events.

A **Customer Managed Data Endpoint** lets the customer expose a single HTTPS
endpoint per experiment that, when called by FeatBit, returns the
sufficient statistics the analysis engine needs. FeatBit never sees raw events
— only per-variant aggregates — which sidesteps the PII, bandwidth, and
egress-cost problems of streaming raw events back.

---

## 2. Configuration model

Two layers, configured in two different places in the UI.

### 2.1 Providers (configured per project, N allowed)

Lives at **Data Warehouse → Customer Managed Data Endpoints → Add provider**.
A project can register **as many providers as it needs** — common shapes:

- One provider per warehouse vendor (Snowflake gateway, BigQuery gateway,
  Datadog gateway).
- One provider per environment / region (`acme-eu`, `acme-us`).
- One provider per team that owns its own stats endpoint.

Each provider holds:

| Field             | Required | Notes                                                                   |
|-------------------|----------|-------------------------------------------------------------------------|
| `name`            | yes      | Display name, e.g. `"Acme Snowflake gateway"`.                          |
| `baseUrl`         | yes      | HTTPS only. Example: `https://stats.acme.internal/featbit`.             |
| `signingSecret`   | yes      | Shared secret used for HMAC-SHA256 request signing (see §5).            |
| `schemaVersion`   | yes      | Hard-pinned to `1` for now. UI shows it; can't be changed.              |
| `timeoutMs`       | no       | Per-request timeout. Default `15000`. Max `60000`.                      |

A provider is **just transport + auth**. It says nothing about which experiment
maps to which URL — that's the per-experiment layer below.

### 2.2 Per-experiment endpoints (configured in Expert experiment setup)

Lives at **Expert experiment setup → step "Data source" → External / other →
Customer Managed Data Endpoint**.

Two routing modes — pick one per experiment:

#### Mode A — Single endpoint (default, 80% case)

One provider + one path serves **primary metric + every guardrail** in a single
HTTP round-trip. Use this when all metrics for the experiment live in the same
warehouse.

| Field             | Required | Notes                                                                   |
|-------------------|----------|-------------------------------------------------------------------------|
| `provider`        | yes      | Pick one registered provider.                                           |
| `path`            | yes      | Appended to `baseUrl`. E.g. `/experiments/headline-test/stats`.         |
| `staticParams`    | no       | Map of extra fields to merge into the request body (see §3).            |

#### Mode B — Per-metric routing (advanced)

Each metric points to its own `(provider, path)` pair. Use this when metrics
genuinely live in different warehouses — e.g. conversion in Snowflake,
latency in Datadog, revenue in BigQuery. The Expert-setup wizard surfaces this
as an "Advanced: route metrics individually" toggle on the data-source step.

For each metric (primary and each guardrail):

| Field             | Required | Notes                                                                   |
|-------------------|----------|-------------------------------------------------------------------------|
| `provider`        | yes      | Pick one registered provider. Different metrics may pick different providers. |
| `path`            | yes      | Appended to that provider's `baseUrl`.                                  |
| `staticParams`    | no       | Per-endpoint static params, merged into that endpoint's request body.   |

FeatBit fans out one HTTP call per **distinct `(provider, path)` pair**. If
three metrics share the same endpoint, that's still one call carrying all
three in `metrics[]`. Calls run in parallel with the same retry / timeout
budget as Mode A — see §7.

**Hard rule for both modes:** an individual endpoint, when called, **must
return all the metrics FeatBit asks for in that call** in one response. Mode B
just means FeatBit may make several such calls and merge them.

---

## 3. Request — `POST {baseUrl}{path}`

### 3.1 Headers

| Header                  | Value                                                                                  |
|-------------------------|----------------------------------------------------------------------------------------|
| `Content-Type`          | `application/json`                                                                     |
| `X-FeatBit-Schema`      | `1`                                                                                    |
| `X-FeatBit-Timestamp`   | Unix seconds at request time. Reject if skew > 300s (replay protection).               |
| `X-FeatBit-Signature`   | `sha256=<hex>` — HMAC-SHA256 of `${timestamp}.${rawBody}` using the provider's secret. |
| `X-FeatBit-Request-Id`  | UUID. Same value on retries — use it for idempotency on the customer side.             |
| `User-Agent`            | `FeatBit-Analysis/1.x`                                                                 |

### 3.2 Body

```json
{
  "schemaVersion":  1,
  "experimentMode": "ab",
  "experimentId":   "exp_2026_headline_test",
  "flagKey":        "headline-copy",
  "envId":          "env_prod",
  "variants":       ["control", "treatment"],
  "window": {
    "start": "2026-04-15T00:00:00Z",
    "end":   "2026-05-02T00:00:00Z"
  },
  "metrics": [
    { "name": "open_saas_click",  "role": "primary",   "type": "binary",     "agg": "once" },
    { "name": "checkout_revenue", "role": "guardrail", "type": "continuous", "agg": "sum",     "inverse": false },
    { "name": "page_load_p95_ms", "role": "guardrail", "type": "continuous", "agg": "average", "inverse": true  }
  ],
  "staticParams": { "tenantId": "acme-eu" }
}
```

Field rules:

- `experimentMode` ∈ `"ab" | "bandit"`. Informational — FeatBit consumes the
  response identically in both modes (same sufficient-statistics shape). The
  customer may use it to route to different SQL or to log differently. See
  §3.3 for what changes per mode.
- `variants` is closed. The customer **must** return one entry per variant in
  `metrics[].data`. Missing a variant → 422 (see §6). For bandit experiments,
  this list contains all N arms, not just two.
- `window.start` is inclusive, `window.end` is exclusive, both ISO-8601 UTC.
- `metrics[].role` ∈ `"primary" | "guardrail" | "reward"`. Informational so the
  customer can route to different SQL if needed; FeatBit reapplies the role in
  analysis. `"reward"` is bandit-only and replaces `"primary"` in that mode.
- `metrics[].type` ∈ `"binary" | "continuous"`. Determines the response shape
  (§4.2).
- `metrics[].agg` ∈ `"once" | "count" | "sum" | "average"`. Tells the customer
  *how* to aggregate per user before summing across the variant. Mirrors
  FeatBit's internal contract (`MetricSpec` in `track-client.ts`).
- `metrics[].inverse` defaults to `false`. When `true`, lower is better (latency,
  error rate). FeatBit applies the inversion in analysis; customer just returns
  the raw stat.
- `staticParams` is opaque to FeatBit — verbatim copy of what the operator put
  in the per-experiment config. Use it for tenancy IDs, region pins, etc.

### 3.3 What changes between A/B/N and bandit experiments

"A/B" in this spec is shorthand for **A/B/N Bayesian** — control + 1..N
treatments — since the Bayesian pipeline (`analyze.ts: runAnalysis()`) already
loops over `treatments: string[]`. The body and response shapes (§4) are
**identical** between A/B/N and bandit — same `{n, k}` for binary, same
`{n, mean, stddev}` (recommended) or `{n, sum, sum_squares}` for continuous.
The differences are in semantics, not shape:

| Aspect              | A/B/N Bayesian                                                  | Bandit                                                                                          |
|---------------------|-----------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| `variants[]`        | 2 or more — control + 1..N treatments. Typically 2–5.           | 2 or more arms. Typically 3–10.                                                                 |
| Traffic allocation  | **Fixed**, set at experiment start (e.g. 50/50 or even 1/N). Stable for the lifetime of the run. FeatBit runs an SRM check to detect violations. | **Dynamic** — FeatBit re-weights on every poll based on observed reward. SRM is interpreted differently (drift is expected). |
| `metrics[]`         | Primary + 0..N guardrails.                                      | Exactly 1 entry, with `role: "reward"`. Guardrails not consumed in v1.                          |
| Call cadence        | On-demand only — fired when the user opens the run summary or clicks "Analyze Latest Data". | Recurring on a schedule (default 15 min, configurable per experiment) so weights can re-update. |
| Window edge         | `end` advances when the user re-asks for analysis.              | `end` advances on every poll — bandit needs fresh data to keep up with non-stationary reward.   |

**The customer endpoint does not need to know which mode is which** — the
per-variant SQL is the same shape either way, just summed over whichever
variant key the request asks for. `experimentMode` is informational only,
useful if the customer wants to log or route differently.

Example A/B/C request (one control + two treatments):

```json
{
  "schemaVersion":  1,
  "experimentMode": "ab",
  "experimentId":   "exp_2026_pricing_copy",
  "flagKey":        "pricing-page-copy",
  "envId":          "env_prod",
  "variants":       ["control", "copy_v1", "copy_v2"],
  "window": {
    "start": "2026-04-15T00:00:00Z",
    "end":   "2026-05-02T00:00:00Z"
  },
  "metrics": [
    { "name": "checkout_completed", "role": "primary",   "type": "binary",     "agg": "once" },
    { "name": "support_ticket",     "role": "guardrail", "type": "binary",     "agg": "once", "inverse": true },
    { "name": "page_load_p95_ms",   "role": "guardrail", "type": "continuous", "agg": "average", "inverse": true }
  ]
}
```

The corresponding response carries one entry per variant per metric — three
variants × three metrics = nine `data` blocks. Same shape as the two-variant
example in §4.2, just one extra column per metric.

Example bandit request body:

```json
{
  "schemaVersion":  1,
  "experimentMode": "bandit",
  "experimentId":   "exp_2026_pricing_bandit",
  "flagKey":        "pricing-page-variant",
  "envId":          "env_prod",
  "variants":       ["control", "v1_blue", "v2_green", "v3_red"],
  "window": {
    "start": "2026-04-15T00:00:00Z",
    "end":   "2026-05-02T08:00:00Z"
  },
  "metrics": [
    { "name": "checkout_completed", "role": "reward", "type": "binary", "agg": "once" }
  ],
  "staticParams": { "tenantId": "acme-eu" }
}
```

Example bandit response body — exactly the same shape as A/B (§4.2), just N arms:

```json
{
  "schemaVersion": 1,
  "experimentId":  "exp_2026_pricing_bandit",
  "computedAt":    "2026-05-02T08:00:11Z",
  "window": {
    "start": "2026-04-15T00:00:00Z",
    "end":   "2026-05-02T08:00:00Z"
  },
  "metrics": {
    "checkout_completed": {
      "type": "binary",
      "agg":  "once",
      "data": {
        "control":  { "n": 8104, "k": 412 },
        "v1_blue":  { "n": 7980, "k": 521 },
        "v2_green": { "n": 8051, "k": 488 },
        "v3_red":   { "n": 8011, "k": 397 }
      }
    }
  }
}
```

---

## 4. Response

### 4.1 Status codes

| Code | Meaning                                                                                |
|------|----------------------------------------------------------------------------------------|
| 200  | OK. Body matches §4.2. Empty variants are allowed (early in the experiment).           |
| 202  | Accepted, results not ready yet. FeatBit will surface "warming up" in the UI.          |
| 422  | Validation failure (unknown variant, schema mismatch, missing metric). Body per §6.    |
| 401  | Bad signature / timestamp skew.                                                        |
| 429  | Rate limited. FeatBit honours `Retry-After`.                                           |
| 503  | Temporarily unavailable. FeatBit retries up to 2× with exponential backoff.            |
| any other | Treated as hard failure. Surfaced as "data source error" in the experiment UI.    |

### 4.2 Body — success (200)

```json
{
  "schemaVersion": 1,
  "experimentId":  "exp_2026_headline_test",
  "computedAt":    "2026-05-02T08:14:11Z",
  "window": {
    "start": "2026-04-15T00:00:00Z",
    "end":   "2026-05-02T00:00:00Z"
  },
  "metrics": {
    "open_saas_click": {
      "type": "binary",
      "agg":  "once",
      "data": {
        "control":   { "n": 12340, "k":  892 },
        "treatment": { "n": 12198, "k": 1124 }
      }
    },
    "checkout_revenue": {
      "type": "continuous",
      "agg":  "sum",
      "data": {
        "control":   { "n": 12340, "mean": 36.56, "stddev": 22.14 },
        "treatment": { "n": 12198, "mean": 41.83, "stddev": 24.07 }
      }
    },
    "page_load_p95_ms": {
      "type": "continuous",
      "agg":  "average",
      "data": {
        "control":   { "n": 12340, "mean": 1499.19, "stddev": 412.50 },
        "treatment": { "n": 12198, "mean": 1438.76, "stddev": 388.91 }
      }
    }
  }
}
```

Per-variant stat shapes:

| Metric type     | Required keys                                        | Notes                                                  |
|-----------------|------------------------------------------------------|--------------------------------------------------------|
| `binary`        | `n`, `k`                                             | `n` = users exposed; `k` = users who converted.        |
| `continuous` ★  | `n`, `mean`, `stddev`  *(recommended)*               | `mean` = per-user contribution averaged across the variant after `agg` is applied. `stddev` = **sample** standard deviation (n−1 denominator) of those per-user contributions. In SQL: `AVG(...) / STDDEV_SAMP(...)`. |
| `continuous`    | `n`, `sum`, `sum_squares`  *(also accepted)*         | Legacy / StatsD-style. `sum` and `sum_squares` are over per-user contributions after `agg` is applied. FeatBit converts to `(mean, variance)` internally. Either shape is fine — pick whichever your warehouse emits naturally. |

> **Why `stddev` is recommended.** Every warehouse has `STDDEV_SAMP()`/`VAR_SAMP()`
> as a one-line aggregate, so analysts write it without thinking. `sum_squares`
> requires `SUM(x*x)`, which most analysts won't reach for, and it can
> overflow on large numeric values. The analyzer (`bayesian.ts:metricMoments()`)
> already consumes `(mean, variance)` directly — there's no analytic reason to
> ship sums when stddev is cheaper to compute and more numerically stable.
>
> **Be explicit about sample vs population.** Use `STDDEV_SAMP` (n−1
> denominator), not `STDDEV_POP`. Some warehouses default to one or the other
> when you write the unqualified `STDDEV()` — don't rely on the default.

That's all the analysis engine needs — these are sufficient statistics for
both Bayesian (Beta–Binomial / Normal) and frequentist (z-test / Welch t-test)
analysis. No raw events. No PII. No timestamps below the window granularity.

### 4.3 Body — partial / warm-up (200 with empty data)

A variant that has no exposed users yet returns zeros, not omission:

```json
"control": { "n": 0, "k": 0 }
```

This lets FeatBit distinguish "experiment hasn't ramped" from "customer
endpoint is broken".

### 4.4 Cross-endpoint reconciliation (Mode B only)

When per-metric routing is on, different endpoints will report **different
`n` for the same variant** — Snowflake's join logic differs from Datadog's,
exposure de-dup may differ, etc. This is expected and FeatBit does **not**
reconcile.

- Each metric is analysed in isolation against its own `n` per variant. This
  is statistically correct: the sample size for "did user X convert on the
  signup CTA" is not the same population as "what was user X's p95 latency".
- The per-experiment SRM check (sample-ratio mismatch) runs on the **primary
  metric's `n` only**, since that's the canonical exposure denominator for
  the experiment.
- The UI shows per-metric `n` next to each metric so the asymmetry is
  visible — never hidden behind a single "experiment N".

If a customer wants metrics aligned to the same population, they implement
Mode A (one endpoint, one set of joins) instead.

---

## 5. Authentication — HMAC-SHA256

Symmetric. Cheap. Universally implementable.

```
signing_string = `${X-FeatBit-Timestamp}.${raw_request_body}`
signature      = HMAC_SHA256(signing_secret, signing_string)
header         = `sha256=${hex(signature)}`
```

Customer verification, in pseudocode:

```python
def verify(request):
    ts  = int(request.headers["X-FeatBit-Timestamp"])
    if abs(now_unix() - ts) > 300:
        raise Unauthorized("stale request")

    sig = request.headers["X-FeatBit-Signature"].removeprefix("sha256=")
    expected = hmac_sha256(secret, f"{ts}.{request.raw_body}").hex()
    if not hmac.compare_digest(sig, expected):
        raise Unauthorized("bad signature")
```

Secret rotation: providers may hold up to two active secrets at once. FeatBit
signs with the **primary** secret; customer accepts either during a rotation
window. UI exposes "rotate secret" with a 7-day grace period.

---

## 6. Error response shape

Used for any non-2xx response that carries a body. UI surfaces `message`
verbatim — keep it human-readable.

```json
{
  "error": {
    "code":    "UNKNOWN_VARIANT",
    "message": "Variant 'treatment_v2' is not configured in the warehouse.",
    "field":   "variants[1]"
  }
}
```

Reserved codes (free to add more):

| Code                  | Meaning                                                            |
|-----------------------|--------------------------------------------------------------------|
| `SCHEMA_VERSION`      | `X-FeatBit-Schema` header is for an unsupported version.           |
| `UNKNOWN_METRIC`      | `metrics[i].name` not registered customer-side.                    |
| `UNKNOWN_VARIANT`     | A `variants[i]` not registered customer-side.                      |
| `WINDOW_OUT_OF_RANGE` | Window asks for data older/younger than the warehouse retains.    |
| `STILL_COMPUTING`     | Use with HTTP 202 when results aren't ready yet.                   |

---

## 7. Calling semantics

When FeatBit calls the endpoint **today**:

| Trigger                                                                    | Frequency                                       |
|----------------------------------------------------------------------------|-------------------------------------------------|
| A/B/N — user opens the run summary (auto-trigger when no result cached).   | On-demand. One call per experiment open.        |
| A/B/N — user clicks **Analyze Latest Data**.                               | On-demand. At most 1 in flight per experiment.  |
| Bandit — same two triggers as A/B/N.                                       | On-demand only, because there is **no recurring scheduler in the FeatBit codebase yet**. See §7.1. |

Concurrency: at most **1 in-flight call per experiment** across all triggers.
A user-triggered call that arrives while a scheduled call is in flight (once
schedulers exist — see §7.1) reuses the in-flight result rather than firing a
duplicate request.

### 7.1 Bandit recurring polling — designed but not yet implemented

A bandit without periodic re-weighting is just an A/B/N test with N variants
that never reallocates traffic. To make bandit actually function, FeatBit will
eventually need:

1. **A scheduler source** — Cloudflare cron trigger, Durable Object alarm, or
   an external worker — that fires once per active bandit experiment on a
   configurable interval (proposed default: 15 min, min 5 min).
2. **Weight persistence** — somewhere to write the freshly computed
   `bandit_weights` so the next flag evaluation picks them up.
3. **Propagation to flag eval** — track-service / SDK edge needs to read the
   updated weights without a redeploy.

None of (1)–(3) exist in `modules/web` today. When they do ship, the **customer
endpoint contract in this spec is already sufficient** — the scheduler will
issue the same `POST` with `experimentMode: "bandit"`, the response shape is
unchanged. So an endpoint implemented to v1 today will work without changes
once the scheduler lands.

Recommendation for customers building bandit endpoints **now**: implement them
the same way you'd implement A/B/N endpoints. The traffic profile will look
like A/B/N (on-demand only) until FeatBit ships the bandit scheduler; you
won't need to change anything when it does.

### 7.2 Defaults FeatBit obeys

| Setting             | Value                                                              |
|---------------------|--------------------------------------------------------------------|
| Timeout             | 15s per attempt (provider-overridable up to 60s).                  |
| Retry               | Max 2 retries on `503` and network errors, exponential backoff (1s, 4s). Total budget capped at provider timeout × 3. |
| Concurrency         | 1 in-flight call per experiment (across all triggers).             |
| Customer-side cron  | Not needed — FeatBit always pulls.                                 |

---

## 8. Test endpoint (recommended, not required)

The provider config UI ships a **Test** button that POSTs a fixed sample
request to **the provider's `baseUrl` directly** (no per-experiment path
appended), with `experimentId: "featbit-ping"`, `flagKey: "featbit-ping"`,
empty `variants`, and `metrics: []`. The customer should:

- Verify the signature.
- Recognise the magic `experimentId === "featbit-ping"` and return `200` with
  `{ "schemaVersion": 1, "experimentId": "featbit-ping", "computedAt": "<now>", "metrics": {} }`.

This proves transport + auth without needing a real experiment to exist
warehouse-side, and runs against the provider as a whole — no per-experiment
config required.

The Test button is gated behind successful save of the provider so the
signing secret exists in the DB before any signed request is sent.

**Retry policy for the ping**: same as a normal call — 503 + network errors
retried up to 2× with `[1s, 4s]` backoff. Timeouts are **not** retried (they
suggest the endpoint is overloaded; retrying compounds the problem).

---

## 9. Forward-compat rules

- New optional fields → safe in `v1`. Customer endpoints **must ignore**
  unknown fields in the request.
- New required fields, removed fields, semantic changes → ship as `v2`.
  FeatBit will continue calling existing providers with `X-FeatBit-Schema: 1`
  until the operator opts a provider into `v2`.
- New `metrics[].type` values (e.g. `"ratio"`, `"quantile"`) → safe in `v1` as
  long as the response shape for unknown types degrades to `null` and FeatBit
  treats `null` as "metric not supported by this provider".

---

## 10. Open questions for review

1. **HMAC vs OAuth2 client-credentials.** HMAC is dead simple but every
   customer rolls their own verifier. OAuth2 means we depend on their IdP. Going
   with HMAC for v1; revisit if enterprise customers push back.
2. **Mode B fan-out concurrency cap.** When per-metric routing splits an
   experiment across, say, 4 providers, FeatBit fires 4 calls in parallel.
   That's fine for one user clicking Analyze, but the hourly background
   refresh (§7) could fan out 4× across the whole project. Need a project-level
   "max parallel provider calls" knob, or per-provider rate limiting via
   `429 + Retry-After`. Leaning on the latter — providers know their own
   limits — but worth confirming.
3. **Streaming / SSE for long-running computes.** Right now `202 + poll` is
   the escape hatch. Worth designing properly only if real customers report
   compute latency > 30s.
4. **Variant-level audience filters.** Today the request body has no audience
   filter — the customer is expected to apply the same filter that the
   experiment is gated on. Should we pass `audienceFilters` explicitly so
   customer SQL can re-apply it?
