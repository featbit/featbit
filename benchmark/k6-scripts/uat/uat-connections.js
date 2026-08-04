import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

import { instances, controlPlaneUrl, controlPlaneApiKey, testConfig } from './uat-config.js';
import { TestAppClient } from './helpers/test-app-client.js';
import { ControlPlaneClient } from './helpers/control-plane-client.js';
import {
  assertConnected,
  assertDisconnected,
} from './helpers/assertions.js';
import { handleSummary } from './uat-reporter.js';

// Re-export the summary handler so k6 picks it up
export { handleSummary };

// ── Custom metrics ──────────────────────────────────────────────────────────────
const connectLatency = new Trend('connect_latency_ms');
const disconnectLatency = new Trend('disconnect_latency_ms');
const fullSyncLatency = new Trend('full_sync_latency_ms');
const connectionsEstablished = new Counter('connections_established');
const connectionsClosed = new Counter('connections_closed');
const fullSyncsReceived = new Counter('full_syncs_received');
const uatChecksPassed = new Counter('uat_checks_passed');
const uatChecksFailed = new Counter('uat_checks_failed');

// ── k6 options ──────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    uat_lifecycle: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '5m',
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
  },
};

// ── Build clients at init time ──────────────────────────────────────────────────
const appClients = instances.map((inst) => ({
  id: inst.instanceId,
  client: new TestAppClient(inst.baseUrl),
}));
const cpClient = new ControlPlaneClient(controlPlaneUrl, controlPlaneApiKey);

// ── Helpers ─────────────────────────────────────────────────────────────────────
function record(passed) {
  if (passed) {
    uatChecksPassed.add(1);
  } else {
    uatChecksFailed.add(1);
  }
}

function logPhase(name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE: ${name}`);
  console.log(`${'='.repeat(60)}`);
}

// ── Main UAT flow ───────────────────────────────────────────────────────────────
export default function () {
  console.log(`UAT run starting — ${appClients.length} instance(s) configured`);

  // ── Phase 1: Health Check ───────────────────────────────────────────────────
  logPhase('Health Check');

  let allHealthy = true;
  for (const { id, client } of appClients) {
    const res = client.health();
    const ok = check(res, {
      [`${id}: health status 200`]: (r) => r._status === 200,
      [`${id}: status is healthy`]: (r) => r.status === 'healthy',
    });
    if (ok) {
      console.log(`  ✓ ${id} is healthy`);
    } else {
      console.log(`  ✗ ${id} health check failed (HTTP ${res._status})`);
      allHealthy = false;
    }
    record(ok);
  }

  if (!allHealthy) {
    console.log('ABORT: Not all instances are healthy — skipping remaining phases.');
    return;
  }

  // ── Phase 2: Client Connections Made (TC-01) ────────────────────────────────
  logPhase('Client Connections Made (TC-01)');

  let allConnected = true;
  for (const { id, client } of appClients) {
    const start = Date.now();
    const connectRes = client.connect();
    connectLatency.add(Date.now() - start);

    const connectOk = check(connectRes, {
      [`${id}: connect response connected`]: (r) => r.connected === true,
    });
    record(connectOk);

    if (connectOk) {
      console.log(`  ✓ ${id} connect returned connected=true`);
      connectionsEstablished.add(1);
    } else {
      console.log(`  ✗ ${id} connect failed (HTTP ${connectRes._status})`);
      allConnected = false;
    }

    sleep(testConfig.connectSettleMs / 1000);

    const statusRes = client.status();
    const statusOk = assertConnected(statusRes, id);
    record(statusOk);

    if (statusOk) {
      console.log(`  ✓ ${id} connectionState=Connected`);
    } else {
      console.log(`  ✗ ${id} connectionState=${statusRes.connectionState}`);
      allConnected = false;
    }
  }

  const allConnectedCheck = check(null, {
    'all instances connected': () => allConnected,
  });
  record(allConnectedCheck);

  // ── Phase 2b: Verify connections in Redis (via control-plane) ───────────────
  logPhase('Verify Connections in Redis');

  // Allow time for eval-server → Kafka → control-plane → Redis propagation
  // Retry with backoff since control-plane consumer may still be initializing
  let redisConnections = [];
  let redisQueryOk = false;
  const maxRetries = 3;
  const retryDelayMs = testConfig.kafkaPropagationMs / 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    sleep(retryDelayMs);
    const postConnectRedis = cpClient.getConnections();

    if (postConnectRedis._status === 200 && postConnectRedis.success === true) {
      redisConnections = postConnectRedis.data || [];
      if (redisConnections.length > 0 || attempt === maxRetries) {
        redisQueryOk = true;
        break;
      }
      console.log(`  ⏳ Attempt ${attempt}/${maxRetries}: Redis has 0 connections, retrying...`);
    } else {
      console.log(`  ⏳ Attempt ${attempt}/${maxRetries}: Redis query failed (HTTP ${postConnectRedis._status}), retrying...`);
      if (attempt === maxRetries) {
        redisQueryOk = false;
      }
    }
  }

  const redisCheckOk = check(null, {
    'redis connections query succeeded': () => redisQueryOk,
  });
  record(redisCheckOk);

  if (redisQueryOk) {
    console.log(`  ✓ Redis has ${redisConnections.length} active connection(s)`);

    // Verify each instance's environment appears in Redis connections (match by envId or projectKey)
    for (const { id } of appClients) {
      const inst = instances.find((i) => i.instanceId === id);
      const envId = inst ? inst.environmentId : '';
      const projectKey = inst ? inst.projectKey : '';

      if (envId || projectKey) {
        const found = redisConnections.some(
          (c) => (envId && c.envId === envId) || (projectKey && c.secret === projectKey)
        );
        const secretOk = check(null, {
          [`${id}: connection exists in Redis`]: () => found,
        });
        record(secretOk);

        if (found) {
          console.log(`  ✓ ${id} connection found in Redis (envId=${envId.substring(0, 8)}...)`);
        } else {
          console.log(`  ✗ ${id} connection NOT found in Redis (envId=${envId.substring(0, 8)}..., projectKey=${projectKey})`);
          console.log(`    Redis connections: ${JSON.stringify(redisConnections.map(c => ({envId: c.envId, secret: c.secret})))}`);
        }
      } else {
        console.log(`  ⚠ ${id} has no envId/projectKey configured — skipping Redis check`);
      }
    }
  } else {
    console.log(`  ✗ Failed to query Redis connections after ${maxRetries} attempts`);
  }

  // ── Phase 3: Push Full Sync (TC-03) ─────────────────────────────────────────
  logPhase('Push Full Sync (TC-03)');

  sleep(testConfig.preFullSyncSettleMs / 1000);

  // Trigger full sync via control plane
  console.log(`  Pushing full sync to ${controlPlaneUrl}...`);
  const syncStart = Date.now();
  const pushRes = cpClient.pushFullSync();
  const pushOk = check(pushRes, {
    'push-full-sync status 200': (r) => r._status === 200,
    'push-full-sync success': (r) => r.success === true,
  });
  record(pushOk);

  if (pushOk) {
    console.log(`  ✓ push-eval-full-sync returned success=true`);
  } else {
    console.log(`  ✗ push-eval-full-sync failed (HTTP ${pushRes._status})`);
  }

  // Wait for propagation (Kafka → eval server → clients)
  sleep(testConfig.fullSyncPropagationMs / 1000);

  // Verify clients survived push-full-sync: still connected + flags evaluable
  let allSynced = true;
  for (const { id, client } of appClients) {
    const statusRes = client.status();
    fullSyncLatency.add(Date.now() - syncStart);

    const stillConnected = check(statusRes, {
      [`${id}: still connected after push`]: (r) => r.connectionState === 'Connected',
    });
    record(stillConnected);

    const hasFlagEvals = check(statusRes, {
      [`${id}: flags evaluable after push`]: (r) =>
        r.flagEvaluations && Object.keys(r.flagEvaluations).length > 0,
    });
    record(hasFlagEvals);

    if (stillConnected && hasFlagEvals) {
      const flagCount = Object.keys(statusRes.flagEvaluations).length;
      console.log(`  ✓ ${id} still connected, ${flagCount} flag(s) evaluable after push`);
      fullSyncsReceived.add(1);
    } else {
      console.log(`  ✗ ${id} post-push-full-sync check failed (state=${statusRes.connectionState})`);
      allSynced = false;
    }
  }

  const allSyncedCheck = check(null, {
    'all instances healthy after push-full-sync': () => allSynced,
  });
  record(allSyncedCheck);

  // ── Phase 4: Client Connections Closed (TC-02) ──────────────────────────────
  logPhase('Client Connections Closed (TC-02)');

  let allDisconnected = true;
  for (const { id, client } of appClients) {
    const start = Date.now();
    const disconnectRes = client.disconnect();
    disconnectLatency.add(Date.now() - start);

    const disconnectOk = check(disconnectRes, {
      [`${id}: disconnect response disconnected`]: (r) => r.disconnected === true,
    });
    record(disconnectOk);

    if (disconnectOk) {
      console.log(`  ✓ ${id} disconnect returned disconnected=true`);
      connectionsClosed.add(1);
    } else {
      console.log(`  ✗ ${id} disconnect failed (HTTP ${disconnectRes._status})`);
      allDisconnected = false;
    }

    sleep(testConfig.disconnectSettleMs / 1000);

    const statusRes = client.status();
    const statusOk = assertDisconnected(statusRes, id);
    record(statusOk);

    if (statusOk) {
      console.log(`  ✓ ${id} connectionState=Disconnected`);
    } else {
      console.log(`  ✗ ${id} connectionState=${statusRes.connectionState}`);
      allDisconnected = false;
    }
  }

  const allDisconnectedCheck = check(null, {
    'all instances disconnected': () => allDisconnected,
  });
  record(allDisconnectedCheck);

  // ── Phase 4b: Verify connections removed from Redis ────────────────────────
  logPhase('Verify Connections Removed from Redis');

  // Allow time for eval-server → Kafka → control-plane → Redis propagation
  sleep(testConfig.kafkaPropagationMs / 1000);

  const postDisconnectRedis = cpClient.getConnections();
  const postDisconnectQueryOk = check(postDisconnectRedis, {
    'redis connections query after disconnect succeeded': (r) => r._status === 200 && r.success === true,
  });
  record(postDisconnectQueryOk);

  if (postDisconnectQueryOk) {
    const remaining = postDisconnectRedis.data || [];
    console.log(`  Redis has ${remaining.length} connection(s) after disconnect`);

    for (const { id } of appClients) {
      const inst = instances.find((i) => i.instanceId === id);
      const envId = inst ? inst.environmentId : '';
      const projectKey = inst ? inst.projectKey : '';

      if (envId || projectKey) {
        const stillPresent = remaining.some(
          (c) => (envId && c.envId === envId) || (projectKey && c.secret === projectKey)
        );
        const removedOk = check(null, {
          [`${id}: connection removed from Redis`]: () => !stillPresent,
        });
        record(removedOk);

        if (!stillPresent) {
          console.log(`  ✓ ${id} connection removed from Redis`);
        } else {
          console.log(`  ✗ ${id} connection still in Redis after disconnect`);
        }
      }
    }
  } else {
    console.log(`  ✗ Failed to query Redis connections after disconnect (HTTP ${postDisconnectRedis._status})`);
  }

  // ── Phase 5: Summary ───────────────────────────────────────────────────────
  logPhase('Summary');
  console.log(`  Instances tested:   ${appClients.length}`);
  console.log(`  All connected:      ${allConnected}`);
  console.log(`  Full sync received: ${allSynced}`);
  console.log(`  All disconnected:   ${allDisconnected}`);
  console.log(`  Overall:            ${allConnected && allSynced && allDisconnected ? 'PASS' : 'FAIL'}`);
}
