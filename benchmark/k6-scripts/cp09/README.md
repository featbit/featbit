# CP-09 k6 WebSocket harness

`cp09-connections.js` is the long-running WebSocket client harness for
`cp09-pod-heartbeats`. By default it opens real FeatBit evaluation-server
streaming connections through the nginx active/active load balancer at
`featbit-eval.local:80` (defined in
`e2e/control-plane/01-Infrastructure/nginx.conf`, upstream `featbit_eval`
round-robins across `127.0.0.1:5100` and `127.0.0.1:5101`). When the west pod
dies, the nginx upstream marks it down (`max_fails=1` / `fail_timeout=10s` by
default) and routes new connections — including VU reconnects — to east,
giving the Python scenario a real client-migration observation. When west
recovers, fresh connections distribute back across both clusters via
round-robin.

A legacy per-cluster mode (each VU pinned to west or east at startup) is
preserved for advanced debugging — see `USE_LOAD_BALANCER` below.

## Environment variables — load balancer mode (default)

The script reads this contract from `__ENV`:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `USE_LOAD_BALANCER` | `true` | When `true`, all VUs connect to `STREAMING_HOST:STREAMING_PORT` and reconnects route through the same LB endpoint. Set to `false` to use legacy per-cluster mode (see below). |
| `STREAMING_HOST` | `featbit-eval.local` | Hostname of the nginx active/active LB. |
| `STREAMING_PORT` | `80` | Port of the nginx active/active LB. |
| `WEST_CLIENTS` | `10` | Non-negative integer. **In LB mode** the sum `WEST_CLIENTS + EAST_CLIENTS` determines the VU count; per-cluster placement is delegated to nginx round-robin and verified server-side via the `featbit:connection:*` Redis scan. |
| `EAST_CLIENTS` | `20` | See `WEST_CLIENTS`. |

## Environment variables — legacy per-cluster mode

These are only consulted when `USE_LOAD_BALANCER=false`:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `WEST_CLIENTS` | `10` | Non-negative integer. VUs `1..WEST_CLIENTS` connect to west. |
| `EAST_CLIENTS` | `20` | Non-negative integer. Remaining VUs connect to east. |
| `HOST` | `localhost` | Hostname used for both streaming URLs. |
| `WEST_PORT` | `5100` | West evaluation-server port. |
| `EAST_PORT` | `5101` | East evaluation-server port. |

## Shared environment variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `SDK_TYPE` | `server` | `server` or `client`; controls the streaming token type and handshake. |
| `SERVER_SECRET` | none | Required when `SDK_TYPE=server`. |
| `CLIENT_SECRET` | none | Required when `SDK_TYPE=client`. |
| `EVENT_LOG_PREFIX` | `CP09_EVENT` | Prefix for structured lifecycle events printed to stdout. |
| `RUN_DURATION` | `5m` | k6 duration string. The run exits after this duration unless terminated first. |

`WEST_CLIENTS + EAST_CLIENTS` must be greater than zero.

## Event log format

k6 cannot append to an arbitrary status file, so the harness writes JSONL events
to stdout. Each event line starts with the configured prefix, followed by one
JSON object:

```text
CP09_EVENT {"ts":1716500000000,"vu":1,"cluster":"lb","event":"open","code":null,"details":"initial"}
```

In LB mode the `cluster` field is always `"lb"` because the VU does not know
which nginx backend the connection landed on — use the Redis-side
`featbit:connection:*` scan to verify per-cluster distribution. In legacy mode
`cluster` is `"west"` or `"east"`.

Common `event` values are `open`, `close`, `reconnect`, `message`, and `error`.
The `ts` value is Unix time in milliseconds. The Python runner converts it to
seconds when creating `K6Event` objects.

## Standalone invocation

From `benchmark\k6-scripts\cp09`:

```powershell
k6 run -e WEST_CLIENTS=2 -e EAST_CLIENTS=2 -e SERVER_SECRET=xxx -e RUN_DURATION=30s cp09-connections.js
```

Force legacy per-cluster mode for low-level debugging:

```powershell
k6 run -e USE_LOAD_BALANCER=false -e WEST_CLIENTS=2 -e EAST_CLIENTS=2 -e SERVER_SECRET=xxx -e RUN_DURATION=30s cp09-connections.js
```

Use `-e CLIENT_SECRET=... -e SDK_TYPE=client` instead when validating client
SDK streaming connections.

## Python automation

The CP-09 scenario uses the `K6Runner` helper in
`e2e\control-plane\02-Tests\automation-py\core\k6_runner.py` to launch this
script as a background k6 process, export the k6 summary into the scenario
artifacts directory, tail stdout/stderr for `CP09_EVENT` lines, and stop the
run cleanly from the scenario's cleanup path. `cp09-pod-heartbeats` then
combines the k6 lifecycle events with per-cluster Redis `featbit:connection:*`
scans to assert distribution, true client migration on west failover, and
re-introduction to round-robin after west recovery.
