// init context: importing modules
import ws from "k6/ws";
import { check } from "k6";
import exec from "k6/execution";
import { getToken } from "./get-token.js";
import { Counter, Trend } from "k6/metrics";

// init context: define k6 options
export const options = {
  scenarios: {
    load_testing: {
      executor: "ramping-vus",
      startVus: 1,
      stages: [
        { duration: "30s", target: 4096 },
        { duration: "90s", target: 4096 },
      ],
      gracefulStop: '30s'
    },
  },
};

// init context: global variables
const websocketDuration = 122 * 1000;

const dataSyncRequestCounter = new Counter("data-sync-request");
const dataSyncSuccessCounter = new Counter("data-sync-success");
const dataSyncTrend = new Trend("data-sync-time")

const pingCounter = new Counter("ping-sent");
const pongCounter = new Counter("pong-received");

// vu code
export default function () {
  const token = getToken();

  // const url = `ws://172.31.29.98:5000/streaming?version=2&type=client&token=${token}`;
  const url = `ws://localhost:5000/streaming?version=2&type=client&token=${token}`;

  ws.connect(url, function (socket) {
    let dataSyncSendTime;

    socket.on("open", function open() {
      const user = `k6-vu-${exec.vu.idInTest}`;
      const payload = {
        messageType: "data-sync",
        data: {
          user: {
            userKeyId: user,
            userName: user,
          },
          timestamp: 0,
        },
      };

      const message = JSON.stringify(payload);
      socket.send(message);
      dataSyncSendTime = Date.now();

      dataSyncRequestCounter.add(1);
    });

    socket.on("message", function (message) {
      const user = `k6-vu-${exec.vu.idInTest}`;

      const res = JSON.parse(message);
      if (
        res.messageType === "data-sync" &&
        res.data.eventType === "full" &&
        res.data.userKeyId === user
      ) {
        dataSyncSuccessCounter.add(1);

        const dataSyncReceiveTime = Date.now();
        dataSyncTrend.add(dataSyncReceiveTime - dataSyncSendTime);
      }

      if (res.messageType === "pong") {
        pongCounter.add(1);
      }
    });

    socket.on("close", function (code) {
      check(code, {
        "connection normal closure": (code) => code === 1000 || code === 1001,
      });
    });

    socket.on("error", function (err) {
      if (Object.keys(err).length === 0) {
        return;
      }

      console.log(err, token);
      check(err, {
        "connection error": (err) => err.error() !== "websocket: close sent",
      });
    });

    socket.setInterval(() => {
      const payload = { messageType: "ping", data: null };
      socket.send(JSON.stringify(payload));
      pingCounter.add(1);
    }, 18 * 1000);
    
    socket.setTimeout(() => {
       socket.close();
    }, websocketDuration);
  });
}
