# Per-cluster Redis + Sentinel for FeatBit

Replaces the single **shared host redis** (a continuity gap surfaced by the
active/passive cutover simulation) with an **independent HA Redis per cluster**:
each of west and east runs its own Redis (1 master + 2 replicas) with 3 Sentinels,
and that cluster's FeatBit connects to **its own** Sentinel. No redis is shared
between DCs.

## How FeatBit connects (no code change)

FeatBit's .NET services (api-server, evaluation-server, control-plane) use
StackExchange.Redis 2.13.1, which resolves the Sentinel-elected master from the
connection string's `serviceName=` keyword. So this is **configuration only**:

```
Redis__ConnectionString = featbit-redis:26379,serviceName=mymaster
```

- `featbit-redis:26379` — the in-cluster Sentinel service (bitnami chart).
- `serviceName=mymaster` — the Sentinel master set; StackExchange asks Sentinel
  for the current master and connects to it, following failover automatically.

Verified: with this string, the eval/api pods appear in the Sentinel-elected
master's `CLIENT LIST` and serve flags; on master failover Sentinel re-elects and
StackExchange reconnects to the new master.

## Cross-cluster (control-plane `Redis__Instances`)

The control-plane replicates per-DC consistency state across both clusters' redis:

```
Redis__Instances__0__ConnectionString = featbit-redis:26379,serviceName=mymaster   # LOCAL  (own sentinel)
Redis__Instances__0__DcId             = <local dc>
Redis__Instances__1__ConnectionString = <peer-node-ip>:31649                        # REMOTE (peer master)
Redis__Instances__1__DcId             = <peer dc>
```

Order matters: index 0 is the **local** DC (first), index 1 is the **remote/peer**
DC (second).

**Why `Instances__1` is NOT the peer Sentinel.** Each cluster's Sentinel announces
the master's *in-cluster* FQDN
(`featbit-redis-node-N.featbit-redis-headless.featbit.svc.cluster.local`). Both
clusters share that service name **and** the `featbit` namespace, so the peer's
announced master FQDN resolves — in the *other* cluster — to that cluster's own
same-ordinal pod. Verified: from a west pod, the east-announced master resolved to
`10.244.0.81` (a **west** pod), so a Sentinel-based `Instances__1` would silently
**misdirect** cross-DC writes back to the local redis. Overlapping pod CIDRs
(both `10.244.0.0/16`) make the announced pod IPs non-unique too.

**The forwarder.** `redis-master-forward.yaml` deploys a tiny HAProxy per cluster
that `tcp-check`s redis for `role:master` (master-only routing, follows Sentinel
failover) and is published on **NodePort 31649**. The peer's `Instances__1` dials
`<peer-node-ip>:31649` with **no `serviceName`** → a direct, cross-reachable,
cluster-unique master endpoint. The **local** Sentinel path is left untouched.
Verified end-to-end: a write through the forwarder lands in the *peer* cluster's
redis (and is absent locally), and the control-plane process holds an established
connection to the peer forwarder.

## Files

- `values.yaml` — bitnami/redis chart 23.2.12 (appVersion 8.2.3) values:
  `architecture=replication`, `sentinel.enabled`, 3 nodes, no auth, no persistence
  (ephemeral; api-server repopulates redis from MongoDB on startup), networkPolicy
  off, images pinned to `bitnamilegacy/redis(-sentinel):8.2.1` (bitnami moved the
  free Docker Hub images under `bitnamilegacy/*`).
- `redis-master-forward.yaml` — per-cluster HAProxy master-forwarder (ConfigMap +
  Deployment + NodePort 31649) giving the peer a master-only, failover-following,
  cross-reachable redis endpoint.
- `Deploy-RedisSentinel.ps1` — installs the chart into each cluster, deploys the
  master-forwarder, points that cluster's FeatBit api/eval/control-plane at its own
  Sentinel (`Instances__0`), and wires each control-plane's `Instances__1` to the
  **peer** cluster's master forwarder (discovers node IPs on the shared docker
  network). Idempotent.

## Deploy

Automatic: `Deploy-FeatBitClusters.ps1` calls this at the end when
`-UseRedisSentinel` is true (the default). Standalone / re-run:

```powershell
pwsh ./Deploy-RedisSentinel.ps1 -Contexts west,east
```

## Verify

```bash
# master per cluster (local sentinel)
kubectl --context west -n featbit exec featbit-redis-node-0 -c sentinel -- \
  redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
# flags served via each cluster's own sentinel-backed eval
kubectl --context <c> -n featbit get deploy evaluation-server \
  -o jsonpath='{..env[?(@.name=="Redis__ConnectionString")].value}{"\n"}'

# cross-cluster: peer master forwarder reachable + master-only (run from the OTHER cluster)
kubectl --context west -n featbit exec featbit-redis-node-0 -c sentinel -- \
  redis-cli -h <east-node-ip> -p 31649 INFO replication | grep -E 'role:|connected_slaves'
# control-plane Instances (order: 0=local sentinel, 1=peer forwarder)
kubectl --context <c> -n featbit get deploy control-plane \
  -o jsonpath='{range ..env[?(@.name)]}{.name}={.value}{"\n"}{end}' | grep Instances
```

## Notes / follow-ups

- **Cross-cluster** control-plane redis (`Redis__Instances__1`, the *other* DC) is
  now wired to the peer cluster's **master forwarder** (`<peer-node-ip>:31649`),
  not the peer Sentinel — see "Cross-cluster" above for why. The **local** instance
  (`Redis__Instances__0`) is on the local Sentinel. In BestEffort consistency mode a
  peer outage is tolerated (`CompositeRedisCacheService` logs "...failed for DC
  {DcId}... Continuing").
- The forwarder routes to whichever node currently reports `role:master`, so it
  follows Sentinel failover automatically; HAProxy marks the (non-master) replicas
  DOWN by design, leaving exactly one active backend = the master.
- The legacy host redis (`featbit-infra-redis-1:6379`) becomes **orphaned** once
  FeatBit is on Sentinel (no FeatBit clients). It can be removed from
  `HostInfraComponents`.
- Storage is ephemeral by design for this QA harness; enable `master.persistence`
  /`replica.persistence` in `values.yaml` for durable data.
- A passive cluster's eval may not write the cp09 `featbit:heartbeat:all` entry
  until it has active streaming clients (observed: heartbeat present on the active
  DC, absent on the idle/passive DC); it populates when that DC becomes active.
