import { WebSocket } from 'k6/experimental/websockets';

import { STREAMING_SERVER_URL, STREAMING_CLIENT_URL } from './env.js';
import { check } from 'k6';

const WebSocketReadyState = {
  CONNECTING: 0, // Socket has been created. The connection is not yet open.
  OPEN: 1,        // The connection is open and ready to communicate.
  CLOSING: 2,     // The connection is in the process of closing.
  CLOSED: 3       // The connection is closed or couldn't be opened.
};

const CLIENT_DATA_SYNC_MESSAGE = JSON.stringify({
  messageType: 'data-sync',
  data: {
    user: {
      keyId: `k6-tester`,
      name: `K6 Tester`,
      customizedProperties: [
        { name: 'email', value: `k6-tester@k6.com` },
        { name: 'location', value: '127.0.0.1' },
      ]
    },
    timestamp: 0
  }
});

const SERVER_DATA_SYNC_MESSAGE = JSON.stringify({
  messageType: 'data-sync',
  data: {
    timestamp: 0
  }
});

const CONNECTION_DURATION_SECONDS = 2;

export default async function () {
  console.log(`Starting WebSocket client test for ${CONNECTION_DURATION_SECONDS} seconds...`);

  startWs(STREAMING_CLIENT_URL, 'client');
  // wait for the client WebSocket to finish
  await new Promise(resolve => setTimeout(resolve, CONNECTION_DURATION_SECONDS + 2));

  console.log(`Client WebSocket finished.\n\n`);

  console.log(`Starting WebSocket server test for ${CONNECTION_DURATION_SECONDS} seconds...`);

  startWs(STREAMING_SERVER_URL, 'server');
  // wait for the server WebSocket to finish
  await new Promise(resolve => setTimeout(resolve, CONNECTION_DURATION_SECONDS + 2));

  console.log(`Server WebSocket finished.\n\n`);
}

function startWs(url, type) {
  const ws = new WebSocket(url);

  let echoSent = false;
  let echoReceived = false;

  let dataSyncSent = false;
  let dataSyncReceived = false;

  ws.onopen = () => {
    check(ws, {
      'is connected': (ws) => ws.readyState === WebSocketReadyState.OPEN,
    });

    console.log(`WebSocket connection established: ${url}. Last for ${CONNECTION_DURATION_SECONDS} seconds.`);

    const echoMessage = {
      messageType: 'echo',
      data: Date.now()
    };
    ws.send(JSON.stringify(echoMessage));

    echoSent = true;
    console.log(`Echo message sent from client: ${echoMessage.data}`);

    const dataSyncMessage = type === 'server' ? SERVER_DATA_SYNC_MESSAGE : CLIENT_DATA_SYNC_MESSAGE;
    ws.send(dataSyncMessage);

    dataSyncSent = true;
    console.log(`Data sync message sent from client: ${dataSyncMessage}`);
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.messageType === 'echo') {
      console.log(`Received echo message from server: ${data.data}`);
      echoReceived = true;
    }
    if (data.messageType === 'data-sync') {
      console.log(`Received data sync message from server: ${JSON.stringify(data.data, null, 2)}`);
      dataSyncReceived = true;
    }
  };

  const closeTimeout = setTimeout(() => {
    ws.close();
  }, CONNECTION_DURATION_SECONDS * 1000);

  ws.onclose = () => {
    console.log(`WebSocket connection closed`);

    clearTimeout(closeTimeout);
    check(ws, {
      'is closed': (ws) => ws.readyState === WebSocketReadyState.CLOSED,
      'echo message sent': () => echoSent,
      'echo message received': () => echoReceived,
      'data sync message sent': () => dataSyncSent,
      'data sync message received': () => dataSyncReceived,
    });
  };
}

