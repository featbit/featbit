# Track authentication cache comparison

`/api/public/insight/track` caches successful Client/Server Secret lookups locally
for five seconds. Other HTTP endpoints and WebSocket authentication still read
the store for each authentication attempt. Endpoint metadata selects the cache,
so routing aliases such as case changes or a trailing slash cannot bypass its scope.

The cache keys on the entire Secret, holds at most 10,000 entries per process,
and never slides expiration. The deadline starts before the store lookup. Fixed
lock stripes coalesce successful concurrent misses without an unbounded lock map;
unrelated keys can occasionally share a stripe and wait for each other.
Missing, mismatched, unsupported-type Secrets and storage exceptions are not cached.
Logging remains at the authentication boundary.

Deleting a Secret from the selected store can leave it accepted by `/track` for
up to five seconds per instance. A valid cached entry also continues working
during a store outage. After expiration, deletion returns 401, unsupported types
return 403, and lookup failure returns 503. There is no stale-on-error extension
or assumed active invalidation. Store replication/fallback freshness is a
separate consideration: the five-second bound starts from deletion being visible
in the store actually used for verification.

## Reproduce the controlled comparison

From the repository root, with .NET 10:

```powershell
dotnet run --project modules/evaluation-server/perf/TrackAuthentication -c Release
```

Optional environment variables: `CONCURRENCY` (32), `DURATION_SECONDS` (12), and
`STORE_DELAY_MS` (2). The duration should exceed five seconds to exercise refreshes.

The harness sends real in-process HTTP requests through routing, authentication,
authorization, and the track controller with a valid metric payload. It uses one
Secret and one user, a no-op message producer, and a counting fake store with an
asynchronous delay. Each mode warms up with 100 requests. The baseline removes
the cache endpoint metadata; the harness checks warmup lookup counts to verify
both modes. Reported lookup counts exclude warmup.

Example local Windows run (2026-11-06, Release, 32 concurrent callers, 12 seconds
per mode, requested store delay 2 ms):

| Mode | Requests/s | p50 (ms) | p95 (ms) | p99 (ms) | Store queries / requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 2,256 | 15.683 | 17.594 | 25.251 | 27,089 / 27,089 |
| Cached | 155,583 | 0.056 | 1.831 | 2.276 | 2 / 1,867,109 |

These numbers show the effect of avoiding the simulated lookup; they are not
production throughput predictions. Windows timer scheduling made the requested
2 ms delay substantially longer in practice. TestServer excludes network costs;
the no-op producer excludes real MQ costs; one hot Secret represents the best
cache locality. Mode order, JIT, and local machine load can affect latency.

For deployment decisions, run the existing `benchmark/k6-scripts/track.js` against
otherwise identical baseline/candidate deployments with real Redis, PostgreSQL,
or MongoDB, configuring its URL and Authorization header for a test environment.
Compare HTTP throughput and latency together with actual Secret lookup counts,
using representative Secret cardinality and payloads. Also check cold-start
bursts, eviction, and deletion/outage after cache expiration. No real remote-store
benchmark has been performed for the example above.
