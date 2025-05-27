import exec from 'k6/execution';
import { WebSocket } from 'k6/experimental/websockets';
import { Counter, Trend } from "k6/metrics";

import { generateConnectionToken } from './utils.js';
import { htmlReport } from "./k6-reporter.js";
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js'

const CLIENT_SECRET = "lhNG5qLXKkOOt0hCVDD8FAqfzdaiGib0We8h18hyuDaw";
const ELS_SERVER = "ws://localhost:5100"
const WS_URL = `${ELS_SERVER}/streaming?type=client&token=${generateConnectionToken(CLIENT_SECRET)}`;

const PING_INTERVAL = 18 * 1000; // 18 seconds

const LATENCY = new Trend("latency");
const PING_COUNTER = new Counter("ping_sent");
const PONG_COUNTER = new Counter("pong_received");
const ERROR_COUNTER = new Counter("error_occurred");
const DATA_SYNC_REQUEST_COUNTER = new Counter("data_sync_request");
const DATA_SYNC_SUCCESS_COUNTER = new Counter("data_sync_success");
const CLOSED_CONNECTION_COUNTER = new Counter("connection_closed");

const PING_MESSAGE = JSON.stringify({
  messageType: 'ping',
  data: {}
});

// ramping up requests per second
const THROUGHPUT = __ENV.THROUGHPUT ? parseInt(__ENV.THROUGHPUT) : 100;

// ramping up duration in seconds
const RAMPING_UP_DURATION_SECONDS = __ENV.RAMPING_UP_DURATION_SECONDS ? parseInt(__ENV.RAMPING_UP_DURATION_SECONDS) : 10;

// the target number of VUs based on the throughput and ramping up duration
const RAMPING_UP_TARGET = THROUGHPUT * RAMPING_UP_DURATION_SECONDS;

// duration in seconds to keep the peak number of VUs
const KEEP_PEAK_DURATION_SECONDS = __ENV.KEEP_PEAK_DURATION_SECONDS ? parseInt(__ENV.KEEP_PEAK_DURATION_SECONDS) : 60;

// duration in seconds to ramp down the VUs
const RAMPING_DOWN_DURATION_SECONDS = __ENV.RAMPING_DOWN_DURATION_SECONDS ? parseInt(__ENV.RAMPING_DOWN_DURATION_SECONDS) : 10;

// total session duration in seconds
const SESSION_DURATION_SECONDS = RAMPING_UP_DURATION_SECONDS + KEEP_PEAK_DURATION_SECONDS + RAMPING_DOWN_DURATION_SECONDS;

export const options = {
  scenarios: {
    load_testing: {
      executor: "ramping-vus",
      startVus: 0,
      stages: [
        { duration: `${RAMPING_UP_DURATION_SECONDS}s`, target: RAMPING_UP_TARGET },
        { duration: `${KEEP_PEAK_DURATION_SECONDS}s`, target: RAMPING_UP_TARGET },
        { duration: `${RAMPING_DOWN_DURATION_SECONDS}s`, target: 0 }
      ]
    }
  }
}

export default function () {
  const ws = new WebSocket(WS_URL);
  const keyId = `k6-vu-${exec.vu.idInTest}`;

  let dataSyncSendTime = 0;
  let pingIntervalTask = null;
  let sessionEndTask = null;

  ws.onopen = () => {
    const FULL_DATA_SYNC_MESSAGE = JSON.stringify({
      messageType: 'data-sync',
      data: {
        user: {
          keyId: keyId,
          name: keyId,
          customizedProperties: [
            { name: 'email', value: `${keyId}@k6.com` },
            { name: 'location', value: '127.0.0.1' },
          ]
        },
        timestamp: 0
      }
    });

    dataSyncSendTime = Date.now();
    ws.send(FULL_DATA_SYNC_MESSAGE);
    DATA_SYNC_REQUEST_COUNTER.add(1);

    pingIntervalTask = setInterval(() => {
      ws.send(PING_MESSAGE);
      PING_COUNTER.add(1);
    }, PING_INTERVAL);

    sessionEndTask = setTimeout(() => {
      ws.close();
    }, SESSION_DURATION_SECONDS * 1000);
  }

  ws.onmessage = (e) => {
    const message = JSON.parse(e.data);

    if (message.messageType === 'data-sync' && message.data.eventType === "full" && message.data.userKeyId === keyId) {
      const latency = Date.now() - dataSyncSendTime;
      LATENCY.add(latency);

      DATA_SYNC_SUCCESS_COUNTER.add(1);
    }

    if (message.messageType === "pong") {
      PONG_COUNTER.add(1);
    }
  };

  ws.onerror = (err) => {
    if (Object.keys(err).length === 0) {
      return;
    }

    ERROR_COUNTER.add(1);
  }

  ws.onclose = () => {
    clearInterval(pingIntervalTask);
    clearTimeout(sessionEndTask);

    CLOSED_CONNECTION_COUNTER.add(1);
  }
}

export function handleSummary(data) {
  console.log(`Throughput: ${THROUGHPUT}/s, ${RAMPING_UP_TARGET} max VUs, ${RAMPING_UP_DURATION_SECONDS}s duration for ramping up phase and keep stable for ${KEEP_PEAK_DURATION_SECONDS}s`);

  const report_name = `data-sync-summary-${THROUGHPUT}.html`;

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    [report_name]: htmlReport(data)
  };
}