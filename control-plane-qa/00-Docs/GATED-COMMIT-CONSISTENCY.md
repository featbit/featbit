# Gated-Commit Cross-DC Consistency

**This is the canonical documentation for the consistency feature** — mechanism, configuration
reference, metrics, rollout/rollback, validation, and known limitations. The module READMEs
([`modules/control-plane`](../../modules/control-plane/README.md),
[`modules/evaluation-server`](../../modules/evaluation-server/README.md)) carry short summaries
and link here.

Issue numbers cited throughout (e.g. `#84`) are development-history breadcrumbs: they refer to
the tracker of the fork where this feature was built and reviewed
([wss-rbrennan/featbit](https://github.com/wss-rbrennan/featbit/issues)) and can be viewed
there. They are kept for provenance.

Operator guide for the control plane's **gated-commit** consistency mode, which guarantees
that a flag/segment change is not served by any *live* data center until **every live DC has
it** — closing the cross-DC inconsistency window in the default best-effort broadcast.

> **Default is OFF.** Everything below activates only when `ConsistencyMode=GatedCommit`.
> With the default `BestEffort`, behavior is byte-for-byte unchanged from before this feature.

---

## 1. What it does

Without gating, the control plane writes a change to every DC's Redis (best-effort, failures
swallowed) and immediately republishes to the evaluation servers — so a slow/unreachable DC can
serve the old value while others serve the new one.

**GatedCommit** changes the lifecycle to:

1. **Stage** — the control plane writes the new value into every DC's Redis under a *versioned*
   key (`featbit:flag:{id}:v{ts}`) and records a *pending* change in the source of truth
   (Mongo/Postgres). It does **not** advance the served value, and **withholds** the
   evaluation-server publish.
2. **Gate** — a background **commit coordinator** waits until every **live** DC's Redis actually
   has `v{ts}` (probed directly), where "live" = a DC with at least one unexpired pod lease
   (heartbeats).
3. **Commit** — once all live DCs have it, the coordinator advances the committed pointer in
   every DC, promotes pending→committed in the DB (version-guarded), and republishes to the
   evaluation servers. Only now do SDK clients see the new value.
4. **Serve** — evaluation servers read the *committed* version from their local Redis
   (pointer-driven), so full-sync / incremental-sync / reconnect never serve a staged-but-
   uncommitted value.
5. **Evict & recover** — a DC that stops heartbeating is dropped from the live set after its
   lease expires (so it can't block commits forever). When it returns, a **recovery worker**
   backfills its Redis with the current committed state (flags, segments, **and secrets** — `#91`)
   before it rejoins. Secrets are not staged/gated in either mode; they are backfilled
   unconditionally so SDK auth recovers along with flag/segment values, not after them.

Consistency model: the control plane gates on its *own* per-DC Redis writes plus
lease liveness — it deliberately does **not** wait for evaluation-server acknowledgment
(a stricter, eval-confirmed gate is a possible future extension; see the end of this doc). A partitioned-but-alive DC keeps serving its last *committed* value
(consistent-but-stale) and reconverges on return; it is treated as "not live" while unreachable.

---

## 1a. Leader election (`#71`) — opt-in, default OFF

The three gated-commit workers — the **commit coordinator**, the **recovery worker**, and the
advisory **DcId consistency checker** — can be gated to run on exactly **one** control-plane
replica at a time, elected via a Redis lock. Election is **opt-in**:
`ControlPlane:LeaderElection:Enabled` (default **`false`**).

- **Why opt-in, and why default off:** election only earns its keep when you run **multiple
  replicas** of one control-plane deployment sharing a single commit pipeline. The default
  deployment is a single replica, for which election adds a stall surface for zero benefit — a
  transient Redis blip flips the lone instance to not-leader and its gated workers skip ticks even
  though there is nothing else to hand off to. Running without election is safe-but-redundant by
  construction (see "dual leadership is harmless" below), matching this codebase's existing
  opt-in convention (`ConsistencyMode` itself defaults to `BestEffort`).
- **When to enable it:** turn `ControlPlane:LeaderElection:Enabled` on when you actually run more
  than one control-plane replica against the same Redis/config and want exactly one of them
  driving the gated-commit workers (e.g. to avoid duplicate commit-broadcast/backfill work, or to
  keep the advisory DcId-check log/metric single-sourced). A single-replica deployment has no
  reason to enable it.
- **Disabled (default) semantics:** `ILeaderElection` resolves to `AlwaysLeaderElection`, which
  always reports leadership — so **every** replica runs every gated-commit tick.
  `RedisLeaderElector` and its hosted service are not even registered. This is safe (every
  operation the gated workers perform is idempotent/version-guarded — see "dual leadership is
  harmless" below) but redundant under multiple replicas: N replicas each running the same tick
  do N× the work for the same effect. `AlwaysLeaderElection` still emits the
  `control_plane.consistency.is_leader` gauge (pinned at a constant `1`) so dashboards built
  against that metric keep working instead of the series disappearing.
- **Enabled semantics — lock location:** a single key (`featbit:control-plane:leader`) in
  `Redis:Instances[0]` (the control plane's "home"/local DC Redis — the same singleton connection
  already used for heartbeat/health storage). Replicas share configuration, so this is one lock
  across all replicas, not one per DC.
- **Enabled semantics — TTL / renew defaults:** `ControlPlane:LeaderElection:TtlSeconds` (default
  **30**) and `ControlPlane:LeaderElection:RenewIntervalSeconds` (default **10**, ≈ TTL/3 so a
  renew tick has multiple chances to succeed before the lock expires). Each replica attempts to
  acquire/renew immediately on start, then on every renew-interval tick.
- **Enabled semantics — failover characteristics:** on a graceful stop, the leader releases the
  lock immediately, so a standby replica takes over on its very next renew attempt (well under the
  renew interval). On a crash (no graceful release), a standby only takes over once the TTL
  expires — worst case **≤ 30s** by default, which is acceptable against the workers' own tick
  cadence (5s / 10s / 60s).
- **Dual leadership is harmless (applies whether election is enabled or disabled):** election
  here is an *optimization*, not a correctness mechanism — no fencing tokens are used. Every
  operation the gated workers perform is idempotent and version-guarded (commit broadcast +
  version-guarded promote, targeted per-DC backfill, and the advisory DcId check itself changes no
  state), so a window where more than one replica believes it is leader (e.g. during a
  TTL-expiry handover when enabled, or simply every tick on every replica when disabled) produces
  at worst redundant work — never a correctness violation.
- **Non-leader behavior (enabled only):** a non-leader's `RunOnceAsync` returns immediately with
  the method's neutral value (`0` commits / `0` backfills / `null` comparison result) and logs at
  **Debug** (expected steady state, not a warning-worthy condition).
- **Not gated:** `CacheReconciler` deliberately runs on every replica regardless of leadership or
  the enabled/disabled state above — see §1b.

---

## 1b. `CacheReconciler` is deliberately NOT leader-gated

`CacheReconciler` runs in **both** consistency modes (BestEffort and GatedCommit) and reacts to a
*local* signal — its own Redis connection transitioning disconnected→connected — so gating it on
cluster-wide leadership would leave a non-leader replica unable to self-heal its own cache after a
local Redis blip. Its backfill (via the shared `IDcBackfiller`) covers **flags, segments, and
secrets** (`#91`) and is idempotent, so redundant reconciles across replicas are harmless, matching
the same idempotency argument that makes the leader-elected workers' brief dual-leadership windows
safe. A follow-up could gate it too if its
multi-replica redundancy ever becomes a measurable cost, but it is out of scope here.

---

## 1c. Backfill trigger hygiene (`#92`)

Four hardening items on top of the shared `IDcBackfiller`, all applying to **both**
`CacheReconciler` and `RecoveryWorker` (they share one `IDcBackfiller` singleton):

- **Reconnect cooldown (`CacheReconciler` only):** a per-DC minimum interval since that DC's last
  *successful* backfill — `ControlPlane:CacheReconcile:MinBackfillIntervalSeconds` (default **300**).
  Without it, a DC whose Redis link is flapping (repeated disconnect→connect) re-reads the full
  source of truth and rewrites that DC's cache on every reconnect. A DC's FIRST backfill (nothing
  recorded yet — this is what makes the immediate local refill on control-plane startup work) is
  never throttled; only a DC that has already been successfully backfilled recently is. A
  coalesced/guard-skipped call (see below) does **not** arm the cooldown, since it did no work. The
  failure-path retry behavior (a failed backfill clears the connection watermark so the next tick
  retries) is unchanged.
- **Cross-worker coalescing (moved into `IDcBackfiller`):** the per-DC in-flight set used to live on
  `CacheReconciler` only, so a `RecoveryWorker` tick and a `CacheReconciler` tick backfilling the
  SAME DC at the same moment each ran their own independent read/write cycle. The in-flight set now
  lives on the shared `DcBackfiller` singleton itself, so **either** caller's concurrent call for a
  DcId already being backfilled returns immediately (`IDcBackfiller.Skipped`, see below) instead of
  doing redundant work — safe because every underlying write is idempotent/only-advance-guarded
  (`#89`).
- **Honest recovery metrics/logs:** `BackfillDcAsync` returns the sentinel `IDcBackfiller.Skipped`
  (`-1`) — distinct from a legitimate `0` (a real backfill that happened to touch zero flags, e.g. a
  secret/segment-only tick) — when the composite cache is unavailable OR the call coalesced with one
  already in flight. `RecoveryWorker.RunOnceAsync`'s returned/logged count now reflects actual
  repairs (`result != Skipped`), not merely how many DCs were in the "returned" set that tick.
- **Composite-cache guard hoisted to once per tick:** both `RecoveryWorker` and `CacheReconciler`
  now check `IDcBackfiller.IsCompositeCacheAvailable` ONCE, before their per-DC loop; a
  misconfiguration (e.g. a `None` cache provider) logs a single warning for the whole tick — and
  skips the committed-snapshot fetch entirely — instead of one warning (and one wasted snapshot
  fetch) per DC.
- **Redis command-timeout policy:** with `abortConnect=false` and no override, a command to a
  down/unreachable DC blocks for StackExchange.Redis's own default (~5s) `syncTimeout` before
  failing — and RecoveryWorker/CacheReconciler write every flag/segment/secret for a DC
  **sequentially** within a tick, so that stall accumulates linearly for the whole outage.
  `CacheServiceCollectionExtensions.AddRedis` now appends explicit `connectTimeout`/`syncTimeout`
  (default **1500ms** each, see `Redis:ConnectTimeoutMs` / `Redis:SyncTimeoutMs` in §3 — `#108`:
  moved from `ControlPlane:Redis:*`, which is still read as a back-compat fallback) to every per-DC
  connection string, UNLESS that option is already present in the instance's configured
  `ConnectionString` (an operator override always wins). Trade-off: 1500ms is deliberately generous
  relative to a healthy Redis's normal latency to avoid false-positive command failures under real
  but slow load, while still bounding the worst case far below the unbounded default.

---

## 1d. Consistency guarantee: bounded-skew by design (decision record, `#25`)

Gated commit guarantees **no live DC ever serves a version it does not already hold locally** —
but the commit *flip* itself is **bounded-skew, not zero-skew**. When the coordinator advances the
committed pointers, each DC observes its own pointer independently (local Redis read + the MQ
publish), so for a short window — pointer write/replication lag plus MQ delivery, normally
sub-second — one DC may still serve the *previous committed* value while another already serves the
new one. Crucially, by the time the flip begins, **every live DC has already staged the new
version**, so the residual skew is only "old committed vs new committed", never "value you don't
have".

**Decision (Risk `#1` of the implementation plan): accept bounded-skew convergence + MQ push as the
default.** The strict-zero-skew alternative — reading the pointer with a linearizable/primary-only
read on the hot evaluation path — was rejected for the default because it adds a cross-region read
per evaluation-relevant fetch and a hard dependency on primary reachability (a partitioned region
would self-fence: consistent with the design, but expensive for what it buys). Deployments that
need literally zero skew can revisit that trade-off; nothing in the design precludes it.

Corollary recorded for the future: if the source of truth ever becomes async multi-master
(active/active Postgres), the bounded-skew guarantee weakens further (the pointer is no longer
majority-linearizable) and this design degrades toward eventual consistency — recovering the
guarantee would require the stronger eval-server-confirmed gate (a future extension), not a
config change.

---

## 2. Enabling it

### 2.1 Control plane (`modules/control-plane`)
```jsonc
"ControlPlane": {
  "ConsistencyMode": "GatedCommit",   // default "BestEffort"
  "LeaseTtlSeconds": 15,              // how long a heartbeat keeps a DC "live"
  "CommitCoordinator": { "IntervalSeconds": 5 },
  "Recovery":          { "IntervalSeconds": 10 },
  "DcIdConsistency":   { "IntervalSeconds": 60 },
  "CacheReconcile": {
    "IntervalSeconds": 10,
    "MinBackfillIntervalSeconds": 300  // #92: per-DC reconnect-flap cooldown
  }
}
```
And one `Redis:Instances` entry **per DC**, each labeled with its `DcId`, plus (optional) the
connect/sync timeout overrides:
```jsonc
"Redis": {
  "ConnectTimeoutMs": 1500,          // #92/#108: per-DC connection-string timeout overrides
  "SyncTimeoutMs": 1500,             // (#108: moved from ControlPlane:Redis:* — old keys still
                                      // read as a back-compat fallback, see §3)
  "Instances": [
    { "DcId": "west", "ConnectionString": "redis-west:6379", "Password": "" },
    { "DcId": "east", "ConnectionString": "redis-east:6379", "Password": "" }
  ]
}
```
The **first** instance is the control plane's *local* DC (used for heartbeat/health storage).

### 2.2 Evaluation server (`modules/evaluation-server`), in EACH DC
```jsonc
"ControlPlane": {
  "ConsistencyMode": "GatedCommit",
  "DcId": "west",                  // MUST equal this DC's Redis:Instances[].DcId on the control plane
  "Region": "us-west",
  "HeartbeatIntervalSeconds": 5    // MUST be <= LeaseTtlSeconds/3 (see below); default is 5
}
```

### 2.3 ⚠️ The DcId matching requirement (most common misconfiguration)
`DcId` is the **join key** the coordinator uses to map a Redis instance ↔ the live pods in that
DC. **The `Redis:Instances[].DcId` you set on the control plane MUST exactly equal the
`ControlPlane:DcId` reported by that DC's evaluation servers.** If they differ (e.g. `"west"`
vs `"west-1"`), the coordinator can't correlate stage results to leases and **commits for that
DC silently stall** until its lease expires (which masks the misconfig).

The control plane runs a `DcIdConsistencyChecker` that **warns** (does not fail) when a
configured Redis `DcId` has no reporting lease, or a reporting lease has an unknown `DcId`.
Watch for those warnings (and the `unmatched_dc_count` metric) right after enabling.

---

## 3. Config reference

| Key | Default | Where | Purpose |
|---|---|---|---|
| `ControlPlane:ConsistencyMode` | `BestEffort` | CP + ELS | `GatedCommit` turns the whole feature on |
| `ControlPlane:LeaseTtlSeconds` | `15` | CP | Heartbeat → lease lifetime; eviction threshold |
| `ControlPlane:HeartbeatIntervalSeconds` | `5` | ELS | Heartbeat cadence. **MUST be `<= LeaseTtlSeconds/3`** (e.g. 5s against the 15s TTL default) — a slower cadence lets each DC's lease expire between heartbeats, flapping the live set and stalling GatedCommit (`#99`). The control plane logs a one-time-per-DC warning when it detects this. |
| `ControlPlane:HeartbeatStalenessThresholdSeconds` | `15` | ELS | Self-fence (D5, `#22`) readiness threshold: an eval-server pod fails `/health/readiness` (HTTP 503) once it has been unable to publish a heartbeat for longer than this. Default is 3x the `HeartbeatIntervalSeconds` default (5s), coinciding with the `LeaseTtlSeconds` default (15s) — a few missed heartbeats before the fence trips (`#104`; previously 180s, incoherent with the post-`#99` 5s interval default). |
| `ControlPlane:CommitCoordinator:IntervalSeconds` | `5` | CP | Commit-evaluation tick |
| `ControlPlane:Recovery:IntervalSeconds` | `10` | CP | Returning-DC backfill tick |
| `ControlPlane:DcIdConsistency:IntervalSeconds` | `60` | CP | DcId-mismatch advisory check |
| `ControlPlane:LeaderElection:Enabled` | `false` | CP | Opt-in leader election for the gated-commit workers (`#71`, see §1a); default off runs every replica (safe but redundant under multiple replicas) |
| `ControlPlane:LeaderElection:TtlSeconds` | `30` | CP | Leader lock TTL, only relevant when `Enabled=true` (`#71`, see §1a) |
| `ControlPlane:LeaderElection:RenewIntervalSeconds` | `10` | CP | Leader lock acquire/renew tick, only relevant when `Enabled=true` |
| `ControlPlane:StagedFlagGc:IntervalSeconds` | `300` | API/back-end | GC of superseded `v{ts}` keys |
| `ControlPlane:CacheReconcile:MinBackfillIntervalSeconds` | `300` | CP | Per-DC reconnect-flap backfill cooldown (`#92`, see §1c) |
| `Redis:ConnectTimeoutMs` | `1500` | CP | Per-DC Redis connect timeout override (`#92`, see §1c). `#108`: moved from `ControlPlane:Redis:ConnectTimeoutMs`, matching the back-end/eval-server `Redis:*` convention (`#106`); the old key is still read as a back-compat fallback. |
| `Redis:SyncTimeoutMs` | `1500` | CP | Per-DC Redis command (sync) timeout override (`#92`, see §1c). `#108`: moved from `ControlPlane:Redis:SyncTimeoutMs` (same back-compat fallback as above). |
| `Redis:Instances[].DcId` | — | CP | DC label per Redis instance (join key) |
| `ControlPlane:DcId` / `:Region` | — | ELS | This pod's DC identity (must match a Redis `DcId`) |
| `Kafka:Consumer:group.id` | `featbit-control-plane` | CP | Consumer group for the control-plane trigger topics. When left at the shipped default AND `Redis:Instances:0:DcId` is non-empty, the control plane auto-suffixes it with `-{DcId}` (e.g. `featbit-control-plane-west`) so DCs sharing a broker don't collide on a single group id (`#100`). An explicitly-set non-default group id (e.g. `Deploy-FeatBitClusters.ps1`'s per-cluster literal) is always left untouched; no DcId configured leaves the default group id unchanged (single-DC/legacy behavior). See `MqServiceCollectionExtensions.ResolveConsumerGroupId`. |

---

## 4. Metrics

All on the meter **`FeatBit.ControlPlane.Consistency`** (System.Diagnostics.Metrics — scrape via
OpenTelemetry/`MeterListener`):

| Instrument | Type | Tags | Meaning |
|---|---|---|---|
| `control_plane.consistency.commits` | counter | `resource_type`, `env_id` | successful commits |
| `control_plane.consistency.time_to_commit_ms` | histogram | `resource_type` | stage→commit latency |
| `control_plane.consistency.pending_backlog` | gauge | `resource_type` | currently-pending items |
| `control_plane.consistency.evicted_commits` | counter | `dc_id` | commits that proceeded without an evicted DC |
| `control_plane.consistency.unmatched_dc_count` | gauge | `direction` | DcId config/lease mismatches |
| `control_plane.consistency.applied_watermark_lag_ms` | gauge | `dc_id`, `env_id` | live DC's lag (ms) behind the most-advanced live DC's applied watermark, per env (`#69`/`#84`) |
| `control_plane.consistency.is_leader` | gauge | `instance_id` | 1 if this replica currently holds the leader lock, else 0; when election is disabled (default) always reports 1 for every replica (`#71`, see §1a) |

**Alert on:** sustained `pending_backlog > 0` (commits stuck — a live DC not staging, or a DcId
mismatch), rising `evicted_commits` (a DC repeatedly dropping out), and any non-zero
`unmatched_dc_count` (config drift).

---

## 5. Rollout procedure (QA: `control-plane-qa` east/west)

1. **Pre-flight:** confirm each DC's ELS `ControlPlane:DcId` equals that DC's control-plane
   `Redis:Instances[].DcId`. Confirm all DCs are heartbeating (leases present). Two settings
   MUST be coherent or leases flap / processing stalls (both bit the first QA enablement, `#25`):
   - `ControlPlane:HeartbeatIntervalSeconds` ≤ `LeaseTtlSeconds`/3 (e.g. 5s against the 15s TTL).
     The ELS appsettings default is now 5s and `HeartbeatService` falls back to 5s (not 60s) when
     the setting is unset/0; see `#99`. `Deploy-FeatBitClusters.ps1` also sets it explicitly.
   - Each DC's control plane needs its **own Kafka consumer `group.id`** when DCs share a broker
     (e.g. `featbit-control-plane-<dc>`); a shared group id makes change processing single-owner
     and non-deterministic under partitions; see `#100`.
2. **Enable** `ConsistencyMode=GatedCommit` on the control plane and all evaluation servers;
   restart.
3. **Smoke:** watch logs for `DcIdConsistencyChecker` warnings and `unmatched_dc_count`; resolve
   any before proceeding.
4. **Run the validation checklist (§6).**
5. **Roll back** instantly by setting `ConsistencyMode=BestEffort` and restarting — no data
   migration; staged `v{ts}` keys are harmless and GC'd.

---

## 6. Validation checklist (needs the live east/west clusters)

- [ ] **Happy path:** toggle a flag; confirm it goes live in **both** DCs only *after* commit
      (not immediately), and `commits` increments.
- [ ] **One DC slow/down:** block staging to `east` (e.g. pause its Redis); toggle a flag;
      confirm it does **not** go live in `west` while `east` is still missing it; `pending_backlog`
      stays > 0.
- [ ] **Eviction:** keep `east` down past `LeaseTtlSeconds`; confirm the change then commits on
      `west` and `evicted_commits{dc_id=east}` increments.
- [ ] **Recovery:** bring `east` back; confirm the recovery worker backfills its Redis to the
      current committed state (flags, segments, **and secrets** — `#91`) and it serves correct values.
- [ ] **Segments:** repeat happy-path + recovery for a segment change and a segment-dependent
      flag.
- [ ] **Secrets (`#91`):** wipe `east`'s `featbit:secret:*` keys directly (simulating the cache-loss
      scenario the recovery/reconciler backfill exists for); confirm a recovery/reconcile tick
      restores them and SDK auth against `east` succeeds again — without needing a flag/segment
      change to trigger it (secrets are backfilled unconditionally, not gated on a flag/segment event).
- [ ] **DcId mismatch (negative):** deliberately mis-set one ELS `DcId`; confirm
      `DcIdConsistencyChecker` warns and `unmatched_dc_count` is non-zero.
- [ ] **Rollback:** flip back to `BestEffort`; confirm normal immediate propagation resumes.

---

## 7. Automated consistency tests (CP-10 – CP-14)

The validation checklist above is automated by the `control-plane-qa` Python suite
(`02-Tests/automation-py`) as scenarios **CP-10 – CP-14**. They observe Redis committed
pointers / staged versions and the eval-server `/health` endpoints directly.

**Prerequisites**

1. **Deploy in GatedCommit mode.** Set `CONSISTENCY_MODE=GatedCommit` in `deployment.env`
   (or the environment) before `Deploy-FeatBitClusters.ps1`. The deploy script then sets
   `ControlPlane:ConsistencyMode=GatedCommit` on both control planes + eval servers and
   labels each Redis instance with its `DcId` (see §2). The test suite does **not** flip
   cluster mode — it only tells the scenario which mode to expect.
2. **Install Chaos Mesh** (CP-11/CP-12/CP-13 only). The disruptions are chaos-mesh
   `NetworkChaos` objects:
   ```powershell
   .\01-Infrastructure\extras\Deploy-ChaosMesh.ps1   # both clusters
   ```
   Manifests live in `01-Infrastructure/chaos-mesh/`:
   - `cross-dc-partition.yaml` — severs the east↔west link (CP-11 eviction, CP-12 recovery)
   - `eval-kafka-partition.yaml` — severs east eval↔kafka (CP-13 readiness fence)

**Running them**

| Scenario | What it asserts | Disruption (auto-wired by the suite) |
|---|---|---|
| CP-10 | stage→commit gating, committed-pointer convergence, staged versions | none |
| CP-11 | gated-while-live, commit-after-eviction, target stale, reconvergence | cross-DC partition |
| CP-12 | survivor commits while target absent, recovery backfill + convergence | cross-DC partition |
| CP-13 | readiness 503 when heartbeats stale, liveness stays 200, recovery | eval↔kafka partition |
| CP-14 | BestEffort vs GatedCommit shape, rollback | none |

```powershell
# from 02-Tests/automation-py, with the suite's CLI (poetry run automation ...)
automation suite cp10 --env-id <env> --no-dashboard
automation suite cp11 --env-id <env> --no-dashboard      # cross-DC partition auto-applied
automation suite cp12 --env-id <env> --no-dashboard
# CP-13 needs a host-reachable eval readiness URL (eval /health is ClusterIP-only):
#   kubectl --context east -n featbit port-forward svc/evaluation-server 5198:5100
# and a staleness threshold matching the deployment (lower both for a fast trip — see below).
automation suite cp13 --env-id <env> --no-dashboard `
  --east-eval-readiness-url http://localhost:5198/health/readiness `
  --heartbeat-staleness-threshold-seconds 30
```

> **CP-13 timing:** the fence trips after `ControlPlane:HeartbeatStalenessThresholdSeconds`
> (default 15s, i.e. 3x the interval default — see below). For a fast test, set it low on the
> east eval deployment **and** pass the same value to the suite — but keep it **above**
> `ControlPlane:HeartbeatIntervalSeconds` (default 5s) or the pod looks stale between
> heartbeats and flaps. E.g. interval=5, threshold=30.

Scenarios that need a disruption **skip** (they do not fail) when their command is not
configured, so a run on a BestEffort cluster, or without Chaos Mesh, degrades gracefully.

---

## 8. Known limitations / open follow-ups

- **Connected clients during a recovery** (`#54`): after a returned DC's Redis is backfilled, SDK
  clients that stayed connected through the outage keep stale values until they reconnect/next
  full-sync (a per-DC client-refresh push is not yet implemented).
- **Eval-server applied watermark** (`#46`/`#69`): the heartbeat watermark (now covering flags AND
  segments, `#83`) is persisted per-DC in `DcLease.AppliedWatermarks` and consumed by the
  `applied_watermark_lag_ms` gauge (`#84`) — it is **not** used for commit gating (the gate remains
  staged-everywhere), only for the per-DC/per-env lag metric above.
- **Self-fence (D5, `#22`):** implemented as a hard readiness fence — `HeartbeatFreshnessHealthCheck`
  fails `/health/readiness` (HTTP 503) once a pod has been unable to publish a heartbeat for longer
  than `ControlPlane:HeartbeatStalenessThresholdSeconds` (default 15s), pulling a
  partitioned/evicted DC's eval servers out of load-balancer rotation rather than letting them keep
  serving last-committed (consistent-but-stale) values. Liveness is unaffected (the pod is not
  restarted); it rejoins rotation once heartbeats resume. See CP-13 above.
- **EF residual window:** the optimistic guards on `SetPending`/`PromotePending` are atomic on
  Mongo but load-check-save on EF/Postgres (no rowversion) — a documented narrow window.
- **EF `SetPendingAsync` retry-exhaustion edge (`#107`):** on Postgres, `SetPendingAsync`
  (`FeatureFlagService`/`SegmentService`, EF) retries `DbUpdateConcurrencyException` (the xmin
  token, `#76`) with a bounded budget and jittered backoff
  (`PendingOpRetryPolicy.MaxRetries` = 8; `Random(10, 50)ms * attemptNumber` between attempts,
  ~1-2s worst case) rather than retrying unboundedly or making the write atomic via
  `ExecuteUpdate`/jsonb-predicate translation (evaluated and rejected — see `#72` design notes on
  translation fragility) or reordering the handler's Redis-stage-then-DB-write sequence (rejected
  — subtle coordinator interactions). This makes exhaustion effectively unreachable under realistic
  contention, but does not eliminate it: under pathological contention (far more concurrent racers
  on one row than the retry budget can absorb), `SetPendingAsync` still throws after exhausting its
  attempts, and the handler already staged that change to Redis before the DB write — so this
  specific stage is dropped, invisible to the coordinator, superseded only by the next edit of that
  flag/segment. The orphaned Redis stage is reclaimed by `StagedFlagGc`
  (`ControlPlane:StagedFlagGc:IntervalSeconds`, §-referenced above) rather than lingering forever.
  Exhaustion is not silent: it logs an ERROR with the entity type, key/id, version, and attempt
  count before rethrowing, so it is diagnosable via logs even though the write itself is lost.
- **Multi-replica control plane (`#71` — resolved):** the coordinator/recovery/checker workers can be
  gated to run only on the elected leader via the opt-in, default-off
  `ControlPlane:LeaderElection:Enabled` (§1a); left disabled, every replica runs — safe but
  redundant. `CacheReconciler` intentionally still runs on every replica regardless (§1b).
- **Stronger model:** an eval-server-confirmed commit gate — the coordinator would wait for the
  evaluation servers themselves to acknowledge applying a version, rather than for the value to
  be present in each DC's Redis — is a possible future enhancement.
