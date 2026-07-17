# Cross-Cluster Heal Simulation #2 — east down + cross-DC Redis BLOCKED

**Run date:** 2026-06-27 (cluster clock)
**Purpose:** Repeat the heal+cutover scenario, but **block east's Redis from west
before** changing flags — i.e. sever the cross-DC Redis path (control-plane
`Redis__Instances__1` → east master forwarder) so the *live* cross-DC heal
(mechanism A from sim #1) is unavailable. Question: does the east cluster still
heal, and through what path?

## Prompt (verbatim)

> Lets do the same scenario, but also block east's redis from west before changing
> the flags

## How "block east's redis from west" is implemented

East's Redis pods are on overlapping in-cluster CIDRs; the **only** cross-cluster
ingress to east Redis is the **east master-forwarder** (HAProxy, NodePort 31649).
So the block = **scale `featbit-redis-master-fwd` → 0 in east**. East Redis itself
stays up (in-cluster); west simply can't reach it. Verified: from a west pod,
`172.31.0.20:31649` → **Connection refused**.

## Same 3 flags (3 projects), `true`→`false` during outage, restored after
`otel-ad/ad-category`, `otel-cart/cart-readonly-mode`, `otel-payment/payment-provider`.

---

# Phases & results

### Phase 0 — west active; baseline all 3 = `true` in both clusters.

### Phase 1 — east down **+ block**
- east `evaluation-server/api-server/control-plane → 0`.
- **block:** east `featbit-redis-master-fwd → 0`. east Redis nodes stay up.
- Verified block: west → `172.31.0.20:31649` **Connection refused**.

### Phase 2 — change 3 flags → `false` on west (east unreachable)
- west Redis: all `false`.
- east Redis: `cart-readonly-mode`=**true**, `payment-provider`=**true** (STALE — block
  held), `ad-category`=**false** (**leaked**).
- west control-plane logged **2** BestEffort drops
  (`UpsertFlagAsync … failed for DC east … Continuing`,
  `RedisConnectionException: SocketClosed on 172.31.0.20:31649`).
- **Finding (teardown race):** scaling the forwarder to 0 does NOT instantly sever
  the west CP's *already-established* multiplexer connection. The first write
  (`ad-category`) drained through the closing connection before teardown completed;
  the next two were correctly dropped. Blocking by endpoint removal has a brief
  in-flight window.

### Phase 3 — recover east (restore forwarder, then eval → api → control-plane).

### Phase 4 — heal check, Redis API-cache layer
- east Redis **did NOT heal**: `cart`/`payment` still **true** after full recovery
  (DBSIZE 102, 39 flag keys present).
- Root cause: `RedisPopulatingService` skips when `featbit:redis-is-populated="true"`
  ("Redis has been populated before, ignore run again"). East Redis was never wiped
  (only compute went down), so the guard key survived → **repopulation skipped**.
  With the cross-DC path blocked, nothing rewrote the stale keys. Only the legacy
  `featbit:flag:{id}` key exists for cart (no committed-pointer/versioned snapshot).

### Phase 5 — cutover to east; Phase 6 — heal check, SERVING layer
- Queried east eval's `GET /api/public/sdk/server/latest-all` (the actual SDK
  bootstrap) with the per-env server secret:
  - `cart-readonly-mode` → **isEnabled=False** (healed)
  - `payment-provider` → **isEnabled=False** (healed)
- east eval log: `Start consuming … topics: featbit-feature-flag-change,…` (Kafka).
- **Finding (serving heals via shared Kafka):** on recovery east eval resumed its
  Kafka consumer from its committed offset, replayed the flag-change events it missed
  while down, and updated its **in-memory** serving state — so it serves the correct
  values **despite the stale Redis API-cache**. (Matches sim #1 / prior finding that
  eval serving is independent of the `featbit:flag:{id}` cache.)

### Phase 7 — restore
- Set all 3 → `true`. With the forwarder back (cross-DC unblocked), the restore write
  rewrote east's cache via cross-DC, so the previously-stale `cart`/`payment` cache
  entries reconciled to `true`. Verified: cache `true` in both clusters; east eval
  serving `cart-readonly-mode`=True. End state = pre-sim (east active, flags `true`,
  both clusters healthy).

---

# Summary & findings

**Does the cluster heal with cross-DC Redis blocked? The APPLICATION yes, the Redis
API-cache no.**

1. **Serving heals via the shared Kafka stream (mechanism C).** East eval reconciles
   its in-memory serving state by replaying missed `featbit-feature-flag-change`
   events on recovery — independent of the cross-DC Redis path and of the Redis
   API-cache. Apps consuming via the SDK get correct values. Application continuity
   is preserved even with cross-DC Redis severed.

2. **The Redis API-cache (`featbit:flag:{id}`) does NOT self-heal on recovery.**
   `RedisPopulatingService` only runs when Redis is unpopulated; since east Redis
   stayed up (guard key `featbit:redis-is-populated` survived), recovery skipped
   repopulation. With cross-DC blocked, the stale entries persisted — a **latent
   cross-DC cache inconsistency** that self-corrects only on (a) the next change to
   each flag once cross-DC is restored (observed during restore), (b) a Redis
   rebuild/flush, or (c) a control-plane forced full-sync.

3. **Blocking via endpoint removal has a teardown race.** One in-flight write
   (`ad-category`) leaked through the west CP's draining connection after the
   forwarder scaled to 0; the next two were cleanly dropped (BestEffort, logged).

## Correction to sim #1 (cross-cluster-heal-cutover-2026-06-27.md)
Sim #1 attributed east's Redis-cache heal partly to **"mechanism B: shared-Mongo
repopulation on api-server restart (39 keys)."** That was **incorrect**: because
east Redis was never wiped, `RedisPopulatingService` **skips** repopulation (same
guard observed here), and the 39 keys were the pre-existing populated set. Sim #1's
Redis-cache heal was actually **mechanism A (live cross-DC replication) alone**
(east Redis was reachable there), plus serving heal via Kafka (mechanism C). The
"39 keys = repopulation" reading is retracted.

## Heal-mechanism map (corrected, across both sims)
| Layer | Heals via | Needs |
|---|---|---|
| Redis API-cache `featbit:flag:{id}` | **A**: live cross-DC replication (`Instances__1`) | cross-DC path open + east Redis up at change time |
| | (NOT api-server repopulation unless Redis was wiped) | |
| Eval **serving** (SDK-facing) | **C**: shared Kafka replay on recovery | shared MQ + consumer offset retained |
| Full source-of-truth | shared MongoDB | (never lost in this harness) |

## Caveat
Mongo+Kafka are shared in this harness, so the source of truth is never actually
lost. A real per-DC deployment with independent MQ/DB would not get the Kafka-replay
serving heal for free; there, the cross-DC Redis path and/or a control-plane
full-sync become the reconciliation mechanism — making the stale-cache finding (#2)
more consequential.

---

# Resolution (finding #2 fixed)

Branch `fix/cross-dc-cache-self-heal` adds a mode-agnostic **`CacheReconciler`**
(control-plane) that polls **every** configured DC's Redis link (local + peers) and,
when a DC becomes newly reachable (control-plane startup or a disconnected→connected
transition), backfills that DC's cache from the source of truth via a shared
**`DcBackfiller`** (BestEffort → legacy `featbit:flag:{id}` writes; GatedCommit →
staged/committed), then a per-DC `PushFullSync`. It also makes the Redis multiplexers
self-healing (`abortConnect=false`) so a DC that was down at first touch no longer
caches a permanent connect failure.

Two complementary heal paths fall out of "reconcile each DC on reachability":
- **Peer (cross-DC) refill:** the surviving DC backfills a returned peer over the
  cross-DC link as soon as it reconnects.
- **Local refill:** on startup the local in-cluster link is reachable, so the DC
  backfills its **own** cache from the source of truth — bypassing the api-server's
  `RedisPopulatingService` guard (which skips on a compute-only restart) and
  **independent of whether the peer is up**.

**Verified in-cluster (2026-06-27):**
- *Cross-DC refill:* block east forwarder → change 3 flags to `false` on west → east
  Redis stays **stale `true`** across 2 reconciler ticks (bug reproduced) → restore
  the east forwarder → west CP logs `peer DC east … backfilling` → `repaired DC east …
  39 flag(s)` and east **self-heals to `false`**, no manual restore.
- *Local refill:* east fully down + forwarder down → change flags on west → east stale
  → recover **east compute only, forwarder left DOWN** (west cannot push) → east CP
  logs `local DC east is reachable; backfilling … (BestEffort)` → `repaired DC east …
  39 flag(s)` and east **self-heals to `false`** with the peer link still blocked.

Unit tests: `tests/Api.UnitTests/Application/ControlPlane/CacheReconcilerTests.cs`
(local + peer backfill on startup, reconnect transition, steady-state no-op, mode
pass-through, coalesce, disabled, probe-throw, retry-on-failure). Known limitation
(out of scope): the reconciler heals on a connection *transition*; a transient
broadcast failure while the link stays *connected* is not re-reconciled until the next
transition.
