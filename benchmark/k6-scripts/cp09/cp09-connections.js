/*
 * Long-running WebSocket load and lifecycle observer for cp09-pod-heartbeats.
 *
 * The default mode targets the nginx active/active load balancer at
 * featbit-eval.local:80 (defined in e2e/control-plane/01-Infrastructure/nginx.conf,
 * upstream featbit_eval round-robins across 127.0.0.1:5100 and 127.0.0.1:5101).
 * When the west pod dies, the nginx upstream health check (default 1 fail /
 * fail_timeout=10s) marks it down and routes new connections — including
 * VU reconnects — to east, giving us true client migration. When west recovers
 * fail_timeout elapses, nginx re-adds it to rotation, so fresh clients land
 * on west again.
 *
 * Environment variables — load balancer mode (default):
 * - USE_LOAD_BALANCER: "true"|"false", default "true". When true, all VUs
 *   connect through the shared LB and reconnects route through it too.
 * - STREAMING_HOST: string, default "featbit-eval.local".
 * - STREAMING_PORT: int, default 80.
 * - WEST_CLIENTS + EAST_CLIENTS: int, default 10 + 20. In LB mode their SUM
 *   determines the VU count; per-cluster placement is delegated to nginx
 *   round-robin and verified server-side via Redis.
 *
 * Environment variables — legacy per-cluster mode (USE_LOAD_BALANCER=false):
 * - WEST_CLIENTS: int, default 10; VUs 1..WEST_CLIENTS connect to west.
 * - EAST_CLIENTS: int, default 20; remaining VUs connect to east.
 * - HOST: string, default "localhost".
 * - WEST_PORT: int, default 5100.
 * - EAST_PORT: int, default 5101.
 *
 * Shared environment variables:
 * - SDK_TYPE: "server" or "client", default "server".
 * - SERVER_SECRET: string, required when SDK_TYPE=server.
 * - CLIENT_SECRET: string, required when SDK_TYPE=client.
 * - EVENT_LOG_PREFIX: string, default "CP09_EVENT". k6 cannot append to an
 *   arbitrary status file, so lifecycle events are emitted to stdout as:
 *   <prefix> {"ts":...,"vu":...,"cluster":"lb|west|east","event":"...",...}
 *   In LB mode cluster is always "lb" because the VU does not know which
 *   nginx backend the connection landed on — use Redis-side scans
 *   (`featbit:connection:*` keyed per cluster) to verify distribution.
 * - RUN_DURATION: k6 duration string, default "5m". k6 exits after this duration
 *   unless the process receives SIGTERM first.
 *
 * Standalone smoke test:
 *   k6 run -e WEST_CLIENTS=2 -e EAST_CLIENTS=2 -e SERVER_SECRET=... -e RUN_DURATION=30s cp09-connections.js
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Gauge } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';

import { generateConnectionToken } from '../utils.js';

const WEST_CLIENTS = parseIntegerEnv('WEST_CLIENTS', 10);
const EAST_CLIENTS = parseIntegerEnv('EAST_CLIENTS', 20);
const SDK_TYPE = (__ENV.SDK_TYPE || 'server').toLowerCase();
const SERVER_SECRET = __ENV.SERVER_SECRET || '';
const CLIENT_SECRET = __ENV.CLIENT_SECRET || '';
const USE_LOAD_BALANCER = parseBooleanEnv('USE_LOAD_BALANCER', true);
const STREAMING_HOST = __ENV.STREAMING_HOST || 'featbit-eval.local';
const STREAMING_PORT = parseIntegerEnv('STREAMING_PORT', 80);
const WEST_PORT = parseIntegerEnv('WEST_PORT', 5100);
const EAST_PORT = parseIntegerEnv('EAST_PORT', 5101);
const HOST = __ENV.HOST || 'localhost';
const EVENT_LOG_PREFIX = __ENV.EVENT_LOG_PREFIX || 'CP09_EVENT';
const RUN_DURATION = __ENV.RUN_DURATION || '5m';

const PING_INTERVAL_MS = 18 * 1000; // Mirrors benchmark/k6-scripts/data-sync.js.
const RUN_DURATION_MS = parseDurationMs(RUN_DURATION);

// Exponential reconnect backoff (ms): 250, 500, 1000, 2000, 4000, 5000 then cap.
// Total worst-case wait before giving up within a 30s nginx fail_timeout window
// is ~12s; with our tuned 2s fail_timeout we expect the second retry to succeed.
const RECONNECT_BACKOFF_MS = [250, 500, 1000, 2000, 4000, 5000];

function reconnectBackoffMs(attempt) {
  const idx = Math.min(attempt - 1, RECONNECT_BACKOFF_MS.length - 1);
  return RECONNECT_BACKOFF_MS[Math.max(0, idx)];
}

if (SDK_TYPE !== 'server' && SDK_TYPE !== 'client') {
  throw new Error(`SDK_TYPE must be "server" or "client"; got "${SDK_TYPE}"`);
}

if (WEST_CLIENTS + EAST_CLIENTS <= 0) {
  throw new Error('WEST_CLIENTS + EAST_CLIENTS must be greater than 0');
}

const CONNECTION_SECRET = SDK_TYPE === 'server' ? SERVER_SECRET : CLIENT_SECRET;
const REQUIRED_SECRET_NAME = SDK_TYPE === 'server' ? 'SERVER_SECRET' : 'CLIENT_SECRET';

if (!CONNECTION_SECRET) {
  throw new Error(`${REQUIRED_SECRET_NAME} is required when SDK_TYPE=${SDK_TYPE}`);
}

export const options = {
  scenarios: {
    cp09: {
      executor: 'per-vu-iterations',
      vus: WEST_CLIENTS + EAST_CLIENTS,
      iterations: 1,
      maxDuration: RUN_DURATION,
    },
  },
  thresholds: {
    cp09_open_failures: ['count==0'],
  },
};

const opensCounter = new Counter('cp09_opens');
const closesCounter = new Counter('cp09_closes');
const reconnectsCounter = new Counter('cp09_reconnects');
const openFailuresCounter = new Counter('cp09_open_failures');
// Errors raised on an established socket (counted in addition to opens/closes).
// Distinguishes "upgrade succeeded then nginx tore us down" (errorsCounter > 0
// AND closesCounter > 0) from "couldn't even connect" (openFailuresCounter > 0
// alone). The migration assertion in scenarios/cp09.py uses both fields.
const errorsCounter = new Counter('cp09_errors');
const messagesCounter = new Counter('cp09_data_sync_pushes');
const activeConnections = new Gauge('cp09_active_connections');

const PING_MESSAGE = JSON.stringify({
  messageType: 'ping',
  data: {},
});

const PONG_MESSAGE = JSON.stringify({
  messageType: 'pong',
  data: {},
});

export default function () {
  const vu = __VU;
  // In LB mode every VU reports cluster="lb" because nginx round-robin
  // decides which backend each connection lands on. Use Redis-side scans
  // (`featbit:connection:*`) to verify per-cluster distribution.
  const cluster = USE_LOAD_BALANCER ? 'lb' : (vu <= WEST_CLIENTS ? 'west' : 'east');
  const runStartedAt = Date.now();
  let activeForVu = 0;
  let attempt = 0;

  function remainingRunMs() {
    return Math.max(0, RUN_DURATION_MS - (Date.now() - runStartedAt));
  }

  function withinRunDuration() {
    return remainingRunMs() > 0;
  }

  function recordActiveConnectionDelta(delta) {
    activeForVu = Math.max(0, activeForVu + delta);
    activeConnections.add(activeForVu);
  }

  function emit(event, code, details, extra) {
    emitEvent(vu, cluster, event, code, details, extra);
  }

  // Outer reconnect loop. Each `connect(attempt)` call blocks until the
  // socket establishes, runs until the underlying connection closes or
  // errors, then returns. We loop until RUN_DURATION elapses so a VU whose
  // backend pod dies will reconnect via the LB indefinitely (this is what
  // proves cp09's migration assertion). Backoff is exponential-capped so we
  // do not slam nginx during its 2s fail_timeout window.
  while (withinRunDuration()) {
    connect(attempt);
    if (!withinRunDuration()) {
      break;
    }
    attempt += 1;
    const backoff = reconnectBackoffMs(attempt);
    emit('reconnect-backoff', null, `attempt=${attempt} backoff_ms=${backoff}`);
    sleep(backoff / 1000);
  }

  function connect(reconnectAttempt) {
    const url = buildStreamingUrl(cluster);
    let opened = false;
    let closeRecorded = false;
    let errorRecorded = false;

    function recordTerminal(source, code, details) {
      // Both on('close') and on('error') can fire for the same teardown.
      // We only book-keep once so the migration assertion's
      // closes+reconnects counts are not double-counted.
      if (closeRecorded || errorRecorded) {
        return;
      }
      if (source === 'close') {
        closeRecorded = true;
        closesCounter.add(1);
      } else {
        errorRecorded = true;
        errorsCounter.add(1);
      }
      if (opened) {
        recordActiveConnectionDelta(-1);
      }
      emit(source, code, details);
    }

    const response = ws.connect(url, {}, function (socket) {
      let pingInterval = null;
      let runTimeout = null;

      // Centralised teardown: stop the ping pump and the RUN_DURATION timer.
      // Timer APIs differ by k6 version, so feature-detect (#113):
      //   * k6 >= v0.56 (and v1.x) exposes setInterval/clearInterval/
      //     setTimeout/clearTimeout as GLOBALS inside the ws callback, and the
      //     legacy socket.setInterval/socket.clearInterval methods THROW
      //     TypeError on v1.0.0+ (silently swallowing every close event —
      //     cp09's old `closes=0, reconnects=0` failure).
      //   * k6 < v0.56 (e.g. the v0.50 apt package) has NO global timers —
      //     "setInterval is not defined" kills the handler and zero clients
      //     ever connect — but the legacy socket methods work and are
      //     auto-cleared when the socket closes.
      const hasGlobalTimers = typeof setInterval === 'function';

      function clearSocketTimers() {
        if (pingInterval !== null) {
          try { clearInterval(pingInterval); } catch (_) {}
          pingInterval = null;
        }
        if (runTimeout !== null) {
          try { clearTimeout(runTimeout); } catch (_) {}
          runTimeout = null;
        }
      }

      socket.on('open', function () {
        opened = true;
        opensCounter.add(1);
        recordActiveConnectionDelta(1);
        emit('open', null, reconnectAttempt > 0 ? `attempt=${reconnectAttempt}` : 'initial');

        if (reconnectAttempt > 0) {
          reconnectsCounter.add(1);
          emit('reconnect', null, `attempt=${reconnectAttempt}`);
        }

        socket.send(buildDataSyncHandshake(vu));

        const pingPump = function () {
          try { socket.send(PING_MESSAGE); } catch (_) {}
        };
        if (hasGlobalTimers) {
          pingInterval = setInterval(pingPump, PING_INTERVAL_MS);
        } else {
          socket.setInterval(pingPump, PING_INTERVAL_MS);
        }

        const remaining = remainingRunMs();
        if (remaining > 0) {
          const closeSocket = function () {
            try { socket.close(); } catch (_) {}
          };
          if (hasGlobalTimers) {
            runTimeout = setTimeout(closeSocket, remaining);
          } else {
            socket.setTimeout(closeSocket, remaining);
          }
        }
      });

      socket.on('message', function (rawMessage) {
        let message;
        try {
          message = JSON.parse(normalizeSocketMessage(rawMessage));
        } catch (error) {
          emit('parse-error', null, `invalid json: ${formatError(error)}`);
          return;
        }

        if (message.messageType === 'data-sync') {
          messagesCounter.add(1);
          emit('message', null, describeDataSyncMessage(message));
          return;
        }

        if (message.messageType === 'ping') {
          socket.send(PONG_MESSAGE);
          return;
        }

        if (message.messageType === 'pong') {
          return;
        }
      });

      socket.on('close', function (closeEvent) {
        clearSocketTimers();
        const code = extractCloseCode(closeEvent);
        const wasUnexpected = code !== 1000;
        recordTerminal('close', code, `wasUnexpected=${wasUnexpected}`);
      });

      socket.on('error', function (error) {
        // Errors on an established socket (e.g., the upstream pod died
        // mid-stream and nginx tore the connection down). In k6 the
        // on('close') handler fires AFTER on('error'); recordTerminal's
        // idempotency guard ensures we count each teardown exactly once.
        // Without this path the close handler may never fire on TCP-reset
        // teardowns and the VU would never reconnect — this is precisely
        // cp09's Failure 1 mechanic.
        clearSocketTimers();
        recordTerminal('error', null, formatError(error));
        try { socket.close(); } catch (_) {}
      });
    });

    check(response, {
      'cp09 websocket upgrade succeeded': (res) => res && res.status === 101,
    });

    if (!response || response.status !== 101) {
      openFailuresCounter.add(1);
      emit('upgrade-failed', response ? response.status : null, 'websocket upgrade failed');
    }
  }
}

function buildStreamingUrl(cluster) {
  const token = encodeURIComponent(generateConnectionToken(CONNECTION_SECRET));
  if (USE_LOAD_BALANCER) {
    return `ws://${STREAMING_HOST}:${STREAMING_PORT}/streaming?type=${SDK_TYPE}&version=2&token=${token}`;
  }
  const port = cluster === 'west' ? WEST_PORT : EAST_PORT;
  return `ws://${HOST}:${port}/streaming?type=${SDK_TYPE}&version=2&token=${token}`;
}

function buildDataSyncHandshake(vu) {
  if (SDK_TYPE === 'server') {
    return JSON.stringify({
      messageType: 'data-sync',
      data: {
        timestamp: 0,
      },
    });
  }

  return JSON.stringify({
    messageType: 'data-sync',
    data: {
      user: {
        keyId: `cp09-vu-${vu}`,
        name: `cp09 vu ${vu}`,
      },
      timestamp: 0,
    },
  });
}

function emitEvent(vu, cluster, event, code, details, extra) {
  const eventObject = Object.assign({
    ts: Date.now(),
    vu,
    cluster,
    event,
    code: code === undefined ? null : code,
    details: details || '',
  }, extra || {});

  console.log(`${EVENT_LOG_PREFIX} ${JSON.stringify(eventObject)}`);
}

function normalizeSocketMessage(rawMessage) {
  if (typeof rawMessage === 'string') {
    return rawMessage;
  }

  if (rawMessage && typeof rawMessage.data === 'string') {
    return rawMessage.data;
  }

  return String(rawMessage);
}

function describeDataSyncMessage(message) {
  const data = message.data || {};
  const eventType = data.eventType || 'unknown';
  const userKeyId = data.userKeyId ? ` userKeyId=${data.userKeyId}` : '';
  return `messageType=data-sync eventType=${eventType}${userKeyId}`;
}

function extractCloseCode(closeEvent) {
  if (typeof closeEvent === 'number') {
    return closeEvent;
  }

  if (closeEvent && typeof closeEvent.code === 'number') {
    return closeEvent.code;
  }

  return null;
}

function formatError(error) {
  if (!error) {
    return 'unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.error === 'function') {
    return error.error();
  }

  if (error.message) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function parseIntegerEnv(name, defaultValue) {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer; got "${raw}"`);
  }

  return parsed;
}

function parseBooleanEnv(name, defaultValue) {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  throw new Error(`${name} must be a boolean ("true"/"false"); got "${raw}"`);
}

function parseDurationMs(duration) {
  const source = String(duration).trim();
  const pattern = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
  };
  let total = 0;
  let consumed = '';
  let match;

  while ((match = pattern.exec(source)) !== null) {
    total += parseFloat(match[1]) * multipliers[match[2]];
    consumed += match[0];
  }

  if (total <= 0 || consumed !== source) {
    throw new Error(`RUN_DURATION must be a k6 duration string like "30s" or "5m"; got "${duration}"`);
  }

  return total;
}

export function handleSummary(data) {
  return { stdout: textSummary(data, { indent: ' ', enableColors: false }) };
}
