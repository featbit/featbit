import { check } from "k6";
import exec from 'k6/execution';
import { WebSocket } from 'k6/experimental/websockets';
import { Counter, Trend } from "k6/metrics";
import { setTimeout } from 'k6/experimental/timers';
import { generateConnectionToken, sendPingMessage } from "./utils.js";

const secret = "qJHQTVfsZUOu1Q54RLMuIQ-JtrIvNK-k-bARYicOTNQA";
const urlBase = "ws://localhost:5000"
const url = `${urlBase}/streaming?type=client&token=${generateConnectionToken(secret)}`;
const sessionDuration = 92 * 1000;

// metrics
const latency = new Trend("latency");
const pingCounter = new Counter("ping-sent");
const pongCounter = new Counter("pong-received");
const errorCounter = new Counter("error-occurred");

const throughput = parseInt(__ENV.THROUGHPUT);

export const options = {
    scenarios: {
        load_testing: {
            executor: "ramping-vus",
            startVus: 0,
            stages: [
                { duration: "30s", target: throughput },
                { duration: "60s", target: throughput },
            ],
            gracefulStop: '60s'
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

        ws.addEventListener('message', (e) => {
            const message = JSON.parse(e.data);
            if (message.messageType === 'data-sync' && message.data.eventType === "full" && message.data.userKeyId === user) {
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
            check(code, {
                "connection normal closure": (code) => code === 1000 || code === 1001,
            });
        });

        sendPingMessage(ws, pingCounter);
        // after a sessionDuration close the connection
        setTimeout(function () {
            ///console.log('Closed');
            ws.close();
        }, sessionDuration);
    });
}
