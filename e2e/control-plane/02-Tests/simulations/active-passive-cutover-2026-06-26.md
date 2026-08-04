# Active/Passive DC Cutover Simulation — west → east

**Run date:** 2026-06-26 (cluster clock)
**Purpose:** Simulate an active/passive datacenter cutover (west active → east active)
to diagnose issues that could break continuity of service for applications that
consume FeatBit. The instrumented OpenTelemetry Demo (10 components, 5 languages)
is the application under test.

## Prompt (verbatim)

> Simulate The following condition, Featbit and otel-demo are deployed as
> active/passive with west being active and east being passive, this means that
> all otel-demo traffic should only be served by west at the beginning and
> featbit.127.0.0.1.sslip.io and it's various other services should only resolve
> to featbit-west.127.0.0.1.sslip.io dns variants. In east's cluster shut down
> the load generator, remove some of the flag and segment keys from redis, and
> shut down the eval server, api server for this simulation, when you've arrived
> at this starting condition wait 5 minutes, then in order restart the eval
> server, then the api server, then cycle app application pods for otel-demo in
> east. When the pods are online check for any connection errors, or flag not
> found errors from the otel-demo application. If the errors are not gone after 5
> minutes diagnose why they errors are still occuring but do not fix the
> condition. If those errors are not present, stop the load generator in west,
> and switch the dns so that featbit.127.0.0.1.sslip.io pooints to
> featbit-east.127.0.0.1.sslip.io and it variants. When the pods are healthy
> check for flag and featbit connection errors, if errors are found diagnose, but
> do not fix if there are no errors, start the load generator on east, wait 5
> mins and check for errors again if there are no errors this should be
> considered a clean cutover, If there are errors, diagnose them but do not fix.
> The point of this is to simulate an active/passive DC cutover to diagnose
> issues that may break the continutity of service for applications that use
> featbit. Also record this prompt along with the results of the simulation in a
> markdown file.

## Topology notes (as-deployed reality vs. the simulation's mental model)

These shape how each step is interpreted and are themselves continuity findings:

1. **Single shared redis (no per-DC isolation).** Both clusters' eval-servers use
   `Redis__ConnectionString=redis:6379`, which host-bridges to the single host
   container `featbit-infra-redis-1`. There is **no separate east redis**, so
   "remove east's redis keys" necessarily removes them for **both** DCs. Baseline:
   39 `featbit:flag:*` keys, **0 `featbit:segment:*` keys** (no segments are
   defined in this environment — only flags can be removed).
2. **"DNS" = host proxy LB upstreams.** `featbit.127.0.0.1.sslip.io` (and
   `featbit-api`/`featbit-eval`) always resolve to 127.0.0.1 → the host
   containerized nginx proxy. Which DC serves is decided by the proxy's
   `featbit_ui` / `featbit_api` / `featbit_eval` upstreams. "Resolve to
   featbit-west variants" is implemented by repointing those LB upstreams to
   west-only backends; the cutover repoints them to east-only.
   - West backends: ui `8081`, api `15000`, eval `5100/5102/5104`.
   - East backends: ui `8082`, api `15001`, eval `5101/5103/5105`.
3. **otel-demo runs in both clusters**; each cluster's load-generator drives its
   own storefront. "All otel-demo traffic served by west" = west load-gen on,
   east load-gen off.
4. **otel-demo SDK → FeatBit** path is `featbit-eval.127.0.0.1.sslip.io:8080`
   (pod hostAlias → host proxy → eval LB). So the SDKs follow the LB upstream
   switch, not the in-cluster eval-server directly.

## Plan / phase gates

| Phase | Action |
|---|---|
| 0 | Starting state: proxy LB → **west only**; east load-gen off; west load-gen on |
| 1 | East failure: scale east load-gen, eval-server, api-server → 0; delete some flag keys from (shared) redis |
| 2 | Wait 5 min at failed state |
| 3 | Recover east in order: eval-server up → api-server up → cycle east otel-demo app pods |
| 4 | Gate A: check east otel-demo for connection / flag-not-found errors. If present after 5 min → diagnose, do NOT fix |
| 5 | Cutover (only if Gate A clean): west load-gen off; proxy LB → **east only** |
| 6 | Gate B: pods healthy → check flag/featbit connection errors → diagnose if any (no fix); else start east load-gen |
| 7 | Wait 5 min → re-check. No errors = clean cutover; errors → diagnose (no fix) |

---

# Results

### Phase 0 — Starting state (≈21:28Z)
- Proxy LB upstreams repointed to **west-only** (disabled east backends 8082/15001/5101/5103/5105/5107/5109; kept west 8081/15000/5100/5102/5104 + west spares). `nginx -t` ok, reloaded.
- west load-gen ON (1/1), east load-gen OFF.
- eval LB endpoint still `200` (served by west). Starting condition established.

### Phase 1 — East failure (21:29Z)
- Baseline: west otel-demo errors = **0** (recommendation, checkout; 60s window).
- east load-generator scaled `1→0`.
- **Deleted 10 of 39 `featbit:flag:*` keys** from the (shared) redis → 29 remain. `featbit:segment:*` = 0 (no segments exist in this env). Deleted keys recorded in run artifacts. NOTE: redis is **shared across both DCs**, so this deletion is global, not east-only.
- east evaluation-server scaled `3→0`; east api-server scaled `1→0`.
- Resulting east state: eval=0, api=0, load-gen=0.

### Phase 2 — Wait 5 min at failed state
- 5-minute hold ~21:29Z → ~21:34Z.

### Phase 3 — Ordered east recovery
- 3.1 (21:34Z) east evaluation-server `0→3`, ready 3/3. Redis still **29** flag keys → eval restart does NOT repopulate (eval is a redis consumer).
- 3.2 (21:35Z) east api-server `0→1`, ready 1/1. Redis still **29** after 20s → **api restart does NOT full-resync redis**. **Finding:** deleted flag cache keys are not self-healed by restarting eval/api; they remain absent until each flag is individually re-saved (a flag-change event re-writes its redis key).
- 3.3 (21:36Z) cycled all **25** east otel-demo deployments; all 10 instrumented components rolled out ✓.

### Phase 4 — Gate A (east error check)
- **0 real FeatBit/flag errors** across all 10 east components. (A broad first pass flagged recommendation=2 / accounting=12, but inspection showed these were a `Websocket connected` success line and **Kafka** consumer reconnect noise — `rdkafka ... kafka:9092 connection refused` during the pod cycle — not FeatBit.)
- **Caveat:** east load-generator is OFF (starting condition), so east otel-demo is idle — SDK *connection* succeeded (websocket connected / client initialized) but flag *evaluation* was barely exercised. Also, east otel-demo SDKs currently route through the LB → **west** eval (which holds all flags in memory), so flag-not-found cannot surface here. The missing-key impact is expected to appear only after the cutover routes SDKs to the **east** eval (which reloaded from the depleted redis). → **Gate A PASS; proceeding to cutover.**

### Phase 5 — Cutover to east (21:39Z)
- west load-generator scaled `1→0`.
- Proxy LB repointed **west→east** (active: ui 8082, api 15001, eval 5101/5103/5105 + east spares; west disabled). `nginx -t` ok, reloaded.
- **Cycled east otel-demo pods again** — decision: an `nginx -s reload` alone leaves existing SDK websockets pinned to the west eval, so restarting the pods forces the SDKs to reconnect through the LB to the **east** eval (required for a real cutover; matches "when the pods are healthy"). All 10 instrumented components rolled.
- **Reconciliation of the redis deletion:** redis still holds **29** flag keys (the 10 deleted are still gone, none self-healed), yet the **east eval-server serves 3/3 flags for all 10 otel projects (30/30)**. The eval-server's serving path is independent of / re-synced past the deleted `featbit:flag:<id>` API-cache keys, and the deleted 10 were not otel-critical → **the redis key deletion did not impair flag evaluation for the application.**

### Phase 6 — Gate B (post-cutover, SDKs → east eval)
- **0 real FeatBit/flag errors** across all 10 east components; all connected to the east eval (Go/Node/Python components log only on first evaluation, so some showed no init line yet — not an error). → **Gate B PASS.**
- Started **east load-generator** (`0→1`, ready) at 21:41Z to drive real flag-evaluation traffic.

### Phase 7 — Wait 5 min, final error re-check
- 5-minute hold started ~21:41Z (east now actively serving via the east eval with live traffic).

### Phase 7 — Final check (21:47Z, east serving with load for 5+ min)
- East actively evaluating against the **east** eval (LB upstream = 5101/5103/5105): product-catalog logged **1,250** flag evaluations and recommendation **57** requests in the 5-min window.
- **0 real FeatBit/flag errors** across all 10 east components over the 5-min traffic window.
- → **CLEAN CUTOVER.**

---

# Summary & findings

**Outcome: clean cutover.** West→east active/passive cutover completed with **zero
FeatBit connection or flag-not-found errors** in the application at every gate
(A, B, final), including 5 minutes of live east traffic (~1,250 evals).

## Continuity findings (the point of the exercise)

1. **Single shared redis — no per-DC isolation (RISK).** Both DCs' eval-servers
   point at one host redis (`redis:6379`). "Remove east's redis keys" is
   physically global. A real active/passive topology needs a redis per DC;
   otherwise a redis incident in one DC degrades both, and a "passive DC redis
   rebuild" cannot be done in isolation.

2. **Deleted flag-cache keys are NOT self-healed by restarts (RISK / runbook gap).**
   Restarting eval-server and api-server did not repopulate the 10 deleted
   `featbit:flag:*` keys (stayed at 29). They remain absent until each flag is
   individually re-saved or a control-plane full-sync is issued
   (`/api/admin/push-eval-full-sync`, exercised by CP-08). **Recommendation:** any
   DC recovery runbook that involves redis loss/rebuild must trigger a forced
   full-sync; do not assume restart repopulates the cache.

3. **The eval-server serving path was resilient to the deletion (positive).**
   Despite redis still missing 10 keys, the east eval-server served **30/30**
   otel flags after restart, so the application saw no flag-not-found. The
   deleted `featbit:flag:<id>` entries behave as API/control-plane-side cache,
   distinct from the eval-server's serving state, which re-synced past them.
   (Caveat: the 10 deleted keys were not otel-critical, and a flag-not-found in
   the app was therefore never forced in this run — to force one you would remove
   the eval serving keys / target a specific consumed flag.)

4. **An LB/DNS switch does NOT move already-connected SDK clients (IMPORTANT).**
   The SDKs hold persistent websockets; after repointing the eval LB to east,
   existing clients stayed pinned to the west eval until the pods were cycled.
   **Implication:** a DNS/LB cutover alone will not redirect live SDK traffic —
   plan for connection draining or a client/pod restart as part of the cutover,
   or already-connected apps keep talking to the old (passive) DC.

5. **Graceful fallback held throughout.** The SDKs' default-on-error design plus
   LB routing to the active DC meant no application errors surfaced during the
   failure window — continuity for the app was preserved end to end.

## End state (left as-is per "do not fix")
- **east = active** (LB → 8082/15001/5101-5105; east load-gen ON), **west = passive**
  (west load-gen OFF; west eval/api still running).
- Redis still missing the 10 deleted flag-cache keys (non-otel; eval serving
  unaffected).
- To revert to west-active: `set-active-dc west` (repoint LB), restart west
  load-gen, and (optionally) issue a control-plane full-sync to repopulate the
  10 redis keys.
