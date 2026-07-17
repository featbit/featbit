# Featbit Control Plane

The **control-plane** is the management API for the FeatBit platform. When enabled, it functions as the central hub for managing messaging between the API and evaluation servers and any additional functionality that should be executed prior to forwarding the messages.

## What it does

- Consumes messages from the API server for flag changes, segment changes, license updates, and secret updates. Prior to forwarding these messages, it is capable of updating all Redis instances with the upsert that the API server performs.
- Forward the previously consumed messages to the evaluation servers.
- Serves an endpoint used to force a full-sync of all clients connected to all instances of the evaluation servers.

## Consistency modes

The control plane supports two cross-DC consistency modes, selected by
`ControlPlane:ConsistencyMode`:

- **`BestEffort`** (default) — the original behavior, unchanged: every change is written to each
  DC's Redis on a best-effort basis and republished to the evaluation servers immediately. A DC
  whose Redis is unreachable during a change simply misses the write until the next change or a
  cache self-heal.
- **`GatedCommit`** (opt-in) — no flag/segment version is served by any *live* DC until every
  live DC has it. Changes are **staged** to every DC's Redis under a versioned key while the
  publish is withheld; a commit coordinator **gates** on per-DC staging probes plus
  evaluation-server heartbeat leases, then **commits** (advances per-DC committed pointers,
  version-guarded) and republishes. Evaluation servers serve only the committed version
  (pointer-gated reads). Dead DCs are **evicted** from the gate after their lease TTL,
  **backfilled** on return, and an evaluation server that cannot heartbeat fails its readiness
  probe (a consistency-over-availability fence). The commit flip itself is bounded-skew
  (normally sub-second), by documented design.

Regardless of mode, a **cache self-heal** (`CacheReconciler`) rebuilds any DC's Redis (flags,
segments, and secrets) from the source of truth when that DC's link becomes reachable.

The consistency background workers — commit coordinator, recovery worker, DcId consistency
checker — run on every instance by default; their operations are idempotent and version-guarded,
so multiple replicas are safe but redundant. For multi-replica deployments, **opt-in leader
election** (`ControlPlane:LeaderElection:Enabled=true`, default `false`) restricts them to one
elected instance via a Redis TTL lock.

Key configuration (full reference in the operator guide linked below):

| Key | Default | Purpose |
|---|---|---|
| `ControlPlane:ConsistencyMode` | `BestEffort` | Selects the mode; `GatedCommit` is fully opt-in |
| `Redis:Instances[]` (`ConnectionString`, `DcId`) | single local entry | One entry per DC; each `DcId` must match that DC's evaluation-server `ControlPlane:DcId` |
| `ControlPlane:LeaseTtlSeconds` | 15 | Heartbeat lease lifetime / DC eviction threshold |
| `ControlPlane:LeaderElection:Enabled` | `false` | Opt-in single-active workers for multi-replica deployments |
| `Kafka:Consumer:group.id` | `featbit-control-plane` | Automatically suffixed with `Redis:Instances[0].DcId` when set, so control planes sharing a broker never collide |

📖 **The canonical feature documentation is
[`e2e/control-plane/00-Docs/GATED-COMMIT-CONSISTENCY.md`](../../e2e/control-plane/00-Docs/GATED-COMMIT-CONSISTENCY.md)** —
mechanism details, complete config reference, emitted metrics
(`FeatBit.ControlPlane.Consistency` meter), rollout/rollback procedure, validation checklist,
and known limitations. Rollback from `GatedCommit` is a config flip back to `BestEffort` with no
data migration.
