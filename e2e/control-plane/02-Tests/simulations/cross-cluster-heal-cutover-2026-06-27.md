# Cross-Cluster Heal + Cutover Simulation — east outage, mutate-on-west, recover

**Run date:** 2026-06-27 (cluster clock)
**Purpose:** Re-run the active/passive DC cutover, but with a **healing** twist:
while east is down, change a few flags (in different projects) on the surviving
west DC, then recover east and check whether the east cluster **heals** — i.e.
whether east's per-cluster Redis (added by the per-cluster Sentinel work) and its
serving reconcile to the changes made while it was offline.

## Prompt (verbatim)

> rerun the cross cluster cutover simulation, but once east is down change a few
> flags in different projects on west the purpose is to see if the cluster heals

## Topology (as-deployed reality — decides the heal mechanism)

- **Redis: per-cluster** (bitnami Sentinel; our recent work). West and east each have
  their own 3-node Redis+Sentinel. **Not shared.**
- **MongoDB: SHARED** — both clusters' api-servers use `mongodb://…@mongodb:27017`
  (ExternalName → host `featbit-infra-mongodb-1`). The **source of truth is shared.**
- **Kafka (MQ): SHARED** — `kafka:9092` → host `featbit-infra-kafka-1`.
- **Cross-DC Redis** (control-plane `Redis__Instances__1`) → peer cluster's **master
  forwarder** (`<peer-node-ip>:31649`, HAProxy `role:master`, NodePort), per the
  cross-cluster wiring work. Order: `Instances__0` = local Sentinel, `Instances__1`
  = peer.
- "DNS"/active DC = host proxy LB upstreams (`set-active-dc.py`); SDKs reach the
  active eval via `featbit-eval.127.0.0.1.sslip.io:8080`.

Because Mongo+Kafka are shared, a "flag change on west" is globally persisted; the
thing actually under test is whether **east's per-cluster Redis cache** reconciles.

## Flags changed (3 projects; all `true` → `false` during outage, restored after)

| Project | Flag key | Flag id |
|---|---|---|
| otel-ad | `ad-category` | `7fb45e95-896c-4c12-9219-b4750090fb0c` |
| otel-cart | `cart-readonly-mode` | `545e0822-897a-480b-87bc-b475009104d4` |
| otel-payment | `payment-provider` | `e39acb31-4a9b-43b4-881e-b475009109b6` |

---

# Phases & results

### Phase 0 — Establish west-active (≈01:39Z)
- LB repointed east→**west** (`set-active-dc.py west`, 14 upstream lines, `nginx -t` ok).
- west load-gen `0→1`, east load-gen `1→0`.
- Baseline: all 3 flags `isEnabled:true` in **both** clusters' Redis.

### Phase 1 — East down
- east `evaluation-server 3→0`, `api-server 1→0`, `control-plane 1→0` (load-gen already 0).
- **East redis StatefulSet + master-forwarder left running** (only compute down).
- west still serving (LB→west api `200`).

### Phase 2 — Mutate flags on west while east is down
- Set `ad-category`, `cart-readonly-mode`, `payment-provider` → **false** via the
  west API (LB→west; east api down so the write can only land on west).
- **Result (the headline):** all three flipped to `false` in **east Redis too**,
  despite east compute being `0/0`.

### Phase 2 — Mechanism (by elimination + evidence)
- East cluster pods: only `featbit-redis-node-{0,1,2}` + `featbit-redis-master-fwd`
  Running; api/eval/control-plane gone. The **only** writer to east Redis was
  external → the **west control-plane via `Instances__1`**.
- West control-plane held an **ESTABLISHED** TCP conn to the east forwarder
  (`/proc/net/tcp` `14001FAC:7BA1` state `01`); **no "failed for DC east"** broadcast
  errors. → **Heal mechanism A: live cross-DC Redis replication.** East's data plane
  stayed consistent with west *in real time* throughout the compute outage, because
  east's Redis + forwarder remained reachable.

### Phase 3 — Ordered east recovery
- eval `0→3` ✓, api `0→1` ✓, control-plane `0→1` ✓.

### Phase 4 — Heal check (data layer)
- East Redis: all 3 flags `false`; DBSIZE 102, 39 `featbit:flag:*` keys present.
- ⚠️ **Correction (see sim #2, cross-cluster-heal-blocked-redis-2026-06-27.md):** the
  original reading here — "mechanism B: shared-Mongo repopulation (39 keys)" — was
  **wrong**. `RedisPopulatingService` *skips* repopulation when
  `featbit:redis-is-populated="true"`, and east Redis was never wiped, so the 39 keys
  were the pre-existing populated set, NOT a repopulation. The Redis cache here was
  healed by **mechanism A (live cross-DC replication)** while east compute was down
  (east Redis was reachable), and **eval serving** by the shared Kafka replay. Sim #2
  isolates this by blocking the cross-DC path.

### Phase 5 — Cutover to east (≈01:44Z)
- LB repointed west→**east**; west load-gen `1→0`, east `0→1`; cycled east otel-demo
  components (`ad, cart, checkout, frontend, payment`) so SDKs reconnect to east eval.
- eval LB `200`.

### Phase 6 — Heal check (serving layer, under live east traffic)
- East otel-demo SDKs connected to the **east** eval (`featbit-eval…:8080`): cart,
  checkout, frontend, payment FeatBit clients initialized; checkout's Go SDK actively
  evaluating multiple flags.
- `payment` served `provider: 'default'` for the **disabled** `payment-provider`
  flag — a **known/safe** provider; **0** "providerHandler is not a function"
  TypeErrors. The disabled flag healed and served safely.
- **No continuity errors.** The only payment errors are the **unconditional ~15%
  simulated transient failure** (`charge.js`: `if (Math.random() < 0.15)`), which is
  baseline design noise independent of the flag — not a cutover/heal break.

### Phase 7 — Restore (per "put them back the way they were")
- All 3 flags set back to **true** via the active (east) API; verified `true` in
  **both** clusters' Redis. The restore (both DCs up) re-exercised cross-DC
  propagation east→west.

### End state
- east = active (LB→15001/8082/5101…), east load-gen on, west load-gen off — same as
  pre-simulation. Both clusters healthy; all flags `true`.

---

# Summary & findings

**Outcome: the east cluster heals — via two independent mechanisms, both verified.**

1. **Live cross-DC Redis replication (mechanism A, new).** With east *compute* down
   but east Redis+forwarder up, the west control-plane replicated every flag change
   into east Redis in real time through `Redis__Instances__1` → the peer master
   forwarder. East's cache never went stale during the outage. This validates the
   cross-cluster `Instances__1` wiring end-to-end under a real outage.

2. **Eval serving heal via shared Kafka (mechanism C).** East eval reconciles its
   in-memory serving state from the shared `featbit-feature-flag-change` topic on
   recovery, independent of the Redis cache. *(Originally this slot claimed "mechanism
   B: shared-Mongo repopulation" — retracted; see the Phase 4 correction and sim #2.
   `RedisPopulatingService` skips when Redis is already populated, so recovery does
   NOT rebuild the cache unless Redis was wiped.)*

3. **Clean cutover, safe serving.** Post-cutover, east eval served the changed flags
   with no continuity errors; the disabled `payment-provider` resolved to a known
   provider. The ~15% payment "transient" errors are by-design baseline noise.

## Caveat / follow-up (honest scope)
- This run took east **compute** down but left **east Redis + forwarder up**, which is
  what made mechanism A (live cross-DC) observable. **Sim #2** blocks the cross-DC
  path (forwarder down) with east Redis still **populated**, and finds the Redis cache
  does NOT self-heal on recovery (populate-guard skip) while eval serving still heals
  via Kafka (mechanism C). A genuinely **wiped** east Redis (data lost → guard key
  gone) is the one case where `RedisPopulatingService` *would* rebuild the cache from
  shared Mongo on api-server restart — that distinct "Redis destroyed" variant has not
  been run.
- Because Mongo+Kafka are shared, the source of truth is never actually lost in this
  harness; the test specifically validated the **per-cluster Redis cache**
  reconciliation, not a source-of-truth rebuild.
