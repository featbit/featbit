import exec from 'k6/execution';
import { WebSocket } from 'k6/experimental/websockets';
import { Counter, Trend } from "k6/metrics";
import { setTimeout } from 'k6/experimental/timers';
import { generateConnectionToken, sendPingMessage } from "./utils.js";
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js'
import { htmlReport } from "./k6-reporter.js";

const secret = "qJHQTVfsZUOu1Q54RLMuIQ-JtrIvNK-k-bARYicOTNQA";
const urlBase = "ws://localhost:5100"
const url = `${urlBase}/streaming?type=client&token=${generateConnectionToken(secret)}`;
const sessionDuration = 82 * 1000;

// metrics
const latency = new Trend("latency");
const pingCounter = new Counter("ping-sent");
const pongCounter = new Counter("pong-received");
const errorCounter = new Counter("error-occurred");
const dataSyncRequestCounter = new Counter("data-sync-request");
const dataSyncSuccessCounter = new Counter("data-sync-success");

const throughput = parseInt(__ENV.THROUGHPUT);
const phase1Duration = 20;
const phase2Duration = 60;
const target = throughput * phase1Duration;

const readState = (path) => {
    try {
        return parseInt(open(path));
    } catch (e) {
        return 0;
    }
}

const stateFile = `${throughput}_state.txt`;
let iteration = readState(stateFile);
iteration++;

export const options = {
    summaryTrendStats: ["avg","min","med","max","p(90)","p(95)","p(99)","p(99.9)","p(99.99)"],
    scenarios: {
        load_testing: {
            executor: "ramping-vus",
            startVus: 0,
            stages: [
                { duration: `${phase1Duration}s`, target: target },
                { duration: `${phase2Duration}s`, target: target },
            ],
            gracefulStop: '100s'
        },
    },
};

export default function () {
    const ws = new WebSocket(url);
    const user = `k6-vu-${exec.vu.idInTest}`;

    const payload = {
        messageType: "data-sync",
        data: {
            user: {
                keyId: user,
                name: user,
            },
            timestamp: 0,
        },
    };

    ws.addEventListener('open', () => {
        const message = JSON.stringify(payload);
        const dataSyncSendTime = Date.now();
        ws.send(message);
        dataSyncRequestCounter.add(1)

        ws.addEventListener('message', (e) => {
            const message = JSON.parse(e.data);
            if (message.messageType === 'data-sync' && message.data.eventType === "full" && message.data.userKeyId === user) {
                dataSyncSuccessCounter.add(1);
                latency.add(Date.now() - dataSyncSendTime);
            }

            if (message.messageType === "pong") {
                pongCounter.add(1);
            }
        });

        ws.addEventListener("error", function (err) {
            if (Object.keys(err).length === 0) {
                return;
            }

            errorCounter.add(1);
        });

        ws.addEventListener("close", function (code) {
        });

        sendPingMessage(ws, pingCounter);
        // after a sessionDuration close the connection
        setTimeout(function () {
            ws.close();
        }, sessionDuration);
    });
}

export function handleSummary(data) {
    console.log(`Iteration: ${iteration}, Throughput: ${throughput}/s, ${throughput * phase1Duration} max VUs, ${phase1Duration}s duration for first phase and keep stable for ${phase2Duration}s`);
    const report_name = `summary.${throughput}`;
    return {
        [stateFile]: `${iteration}`,
        [`${report_name}_${iteration}.html`]: htmlReport(data),
        'stdout': textSummary(data, { indent: ' ', enableColors: true }), // Show the text summary to stdout...
        [`${report_name}_${iteration}.json`]: JSON.stringify(data), //the default data object
    };
}
