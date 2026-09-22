import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { waitFor, logs } from './stack.mjs';

const pg = (stack, sql) => stack.exec('postgres', ['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'featbit', '-At', '-c', sql]);
const mongo = (stack, code) => stack.exec('mongodb', ['mongosh', '--quiet', '-u', 'admin', '-p', 'local-stack-only', '--authenticationDatabase', 'admin', '--eval', code]);

async function workspaceId(stack) {
  if (stack.db === 'Postgres') return pg(stack, 'SELECT id FROM workspaces ORDER BY created_at LIMIT 1');
  return mongo(stack, 'print(db.getSiblingDB("featbit").Workspaces.findOne()._id.toUUID().toString().match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)[0])');
}

async function events(stack, envId, kind) {
  assert.match(envId, /^[0-9a-f-]{36}$/i);
  const exposure = kind === 'exposure';
  const table = `experiment_${kind}_events`;
  if (stack.olap === 'Postgres') {
    const fields = exposure
      ? "'flagKey', flag_key, 'variationId', variation_id, 'variationValue', variation_value, 'timestamp', (extract(epoch from exposed_at)*1000)::bigint"
      : "'eventName', event_name, 'eventType', event_type, 'numericValue', numeric_value, 'applicationType', application_type, 'timestamp', (extract(epoch from occurred_at)*1000)::bigint";
    const output = await pg(stack, `SELECT json_build_object('id', id, 'envId', env_id, 'userKey', user_key, ${fields}) FROM ${table} WHERE env_id='${envId}'`);
    return output ? output.split(/\r?\n/).map(JSON.parse) : [];
  }
  if (stack.olap === 'MongoDb') {
    const collection = exposure ? 'ExperimentExposureEvents' : 'ExperimentMetricEvents';
    const fields = exposure
      ? 'flagKey:x.flagKey, variationId:x.variationId, variationValue:x.variationValue, timestamp:x.exposedAt.getTime()'
      : 'eventName:x.eventName, eventType:x.eventType, numericValue:x.numericValue, applicationType:x.applicationType, timestamp:x.occurredAt.getTime()';
    return JSON.parse(await mongo(stack, `const d=db.getSiblingDB('featbit'); print(JSON.stringify(d.${collection}.find({envId:UUID('${envId}')}).toArray().map(x=>({id:x._id.toString(),envId:'${envId}',userKey:x.userKey,${fields}}))))`));
  }
  const fields = exposure
    ? 'flag_key AS flagKey, variation_id AS variationId, variation_value AS variationValue, toUnixTimestamp64Milli(exposed_at) AS timestamp'
    : 'event_name AS eventName, event_type AS eventType, numeric_value AS numericValue, application_type AS applicationType, toUnixTimestamp64Milli(occurred_at) AS timestamp';
  const output = await stack.exec('clickhouse', ['clickhouse-client', '--password', 'local-stack-only', '--query',
    `SELECT id, env_id AS envId, user_key AS userKey, ${fields} FROM featbit.${table} WHERE env_id='${envId}' FORMAT JSONEachRow`]);
  return output ? output.split(/\r?\n/).map(JSON.parse) : [];
}

export async function testTrack(stack) {
  const runId = `track-${randomUUID()}`;
  const evidence = { runId, scenario: stack.name, cases: [], startedAt: new Date().toISOString() };
  const headers = { 'Content-Type': 'application/json' };
  const api = async (path, body) => {
    const response = await fetch(`${stack.api}/api/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers,
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    assert.ok(response.ok && result.success, `${path}: HTTP ${response.status} ${JSON.stringify(result)}`);
    return result.data;
  };
  try {
    const login = await api('/identity/login-by-email', { email: 'test@featbit.com', password: '123456' });
    headers.Authorization = `Bearer ${login.token}`;
    headers.Workspace = await workspaceId(stack);
    const organizations = await api('/organizations');
    assert.ok(organizations.length > 0, 'Seed organization missing');
    headers.Organization = organizations[0].id;
    const project = await api('/projects', { name: runId, key: runId });
    const env = project.environments.find(x => x.key === 'dev') ?? project.environments[0];
    assert.ok(env, 'Created project must have an environment');
    const secret = env.secrets.find(x => x.type === 'server')?.value;
    assert.ok(secret, 'Server SDK key missing');
    const variations = [
      { id: randomUUID(), name: 'Control', value: 'false' },
      { id: randomUUID(), name: 'Treatment', value: 'true' },
    ];
    const flag = await api(`/envs/${env.id}/feature-flags`, {
      name: runId, key: runId, description: 'Track end-to-end verification', isEnabled: true,
      variationType: 'boolean', variations, enabledVariationId: variations[1].id,
      disabledVariationId: variations[0].id, tags: [],
    });
    evidence.projectId = project.id;
    evidence.environmentId = env.id;
    evidence.flagKey = flag.key;
    evidence.ui = `${stack.ui}/en/feature-flags/${flag.key}/insights`;
    const expected = [];
    const baseTime = Math.floor((Date.now() - 60_000) / 1000) * 1000 + 123;
    const eventName = runId.replaceAll('-', '_');
    const track = async (label, payload) => {
      const testCase = { label, payload };
      evidence.cases.push(testCase);
      const response = await fetch(`${stack.els}/api/public/insight/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: secret },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
      });
      const body = await response.text();
      Object.assign(testCase, { status: response.status, response: body });
      assert.equal(response.status, 200, `${label}: ${body}`);
    };
    await track('empty', []);
    for (const count of [1, 50, 51, 125]) {
      const payload = [];
      for (let n = 0; n < count; n++) {
        const i = expected.length;
        const userKey = `${runId}-${i}`;
        const variation = variations[i % 2];
        const timestamp = baseTime + i;
        const appType = [null, '', 'dotnet-server-sdk', 'a'.repeat(65), 'b'.repeat(128)][i % 5];
        const numericValue = i + 1.25;
        expected.push({ userKey, variation, timestamp, appType, numericValue });
        payload.push({ user: { keyId: userKey, name: `User ${i}`, customizedProperties: [] },
          variations: [{ featureFlagKey: flag.key, variation: { id: variation.id, value: variation.value }, timestamp }],
          metrics: [{ type: 'Custom', eventName, numericValue, timestamp: timestamp + 1000,
            ...(appType === null ? {} : { appType }) }],
        });
      }
      if (count === 125) payload.push(null, { user: { keyId: '' }, metrics: [], variations: [] });
      await track(`${count * 2} expanded messages`, payload);
    }
    await track('invalid users and oversized appType are rejected', [null,
      { user: { keyId: '' }, variations: [], metrics: [] },
      { user: { keyId: `${runId}-invalid` }, metrics: [{ type: 'Custom', eventName,
        numericValue: 999, timestamp: baseTime + 1000, appType: 'x'.repeat(129) }] },
    ]);
    let exposureRows, metricRows;
    const readAndAssert = async () => {
      exposureRows = await events(stack, env.id, 'exposure');
      metricRows = await events(stack, env.id, 'metric');
      evidence.exposures = exposureRows;
      evidence.metrics = metricRows;
      assert.equal(exposureRows.length, expected.length, 'Exposure count');
      assert.equal(metricRows.length, expected.length, 'Metric count');
      for (const rows of [exposureRows, metricRows]) {
        assert.equal(new Set(rows.map(x => x.id)).size, expected.length, 'Unique record IDs');
        assert.equal(new Set(rows.map(x => x.userKey)).size, expected.length, 'No duplicate/missing users');
      }
      for (const item of expected) {
        const exposure = exposureRows.find(x => x.userKey === item.userKey);
        const metric = metricRows.find(x => x.userKey === item.userKey);
        assert.ok(exposure && metric, `Missing user ${item.userKey}`);
        assert.equal(exposure.envId, env.id);
        assert.equal(exposure.flagKey, flag.key);
        assert.equal(exposure.variationId, item.variation.id);
        assert.equal(exposure.variationValue, item.variation.value);
        assert.equal(Number(exposure.timestamp), item.timestamp, 'Exposure millisecond timestamp');
        assert.equal(metric.envId, env.id);
        assert.equal(metric.eventName, eventName);
        assert.equal(metric.eventType, 'Custom');
        assert.equal(Number(metric.numericValue), item.numericValue);
        const expectedAppType = stack.olap === 'ClickHouse' ? item.appType ?? '' : item.appType;
        assert.equal(metric.applicationType ?? null, expectedAppType);
        assert.equal(Number(metric.timestamp), item.timestamp + 1000, 'Metric millisecond timestamp');
      }
    };
    await waitFor('Track persistence', readAndAssert, 120_000);
    // Recheck after another flush to catch delayed extra records from rejected inputs.
    await new Promise(resolve => setTimeout(resolve, 3000));
    await readAndAssert();
    evidence.exposures = exposureRows;
    evidence.metrics = metricRows;
    const from = baseTime - 1000, to = baseTime + 5000;
    const insights = await api(`/envs/${env.id}/feature-flags/insights?${new URLSearchParams({
      featureFlagKey: flag.key, intervalType: 'MINUTE', from: String(from), to: String(to),
    })}`);
    evidence.insights = insights;
    for (const variation of variations) {
      const count = insights.flatMap(x => x.variations).filter(x => x.variation === variation.name).reduce((sum, x) => sum + x.count, 0);
      assert.equal(count, expected.filter(x => x.variation.id === variation.id).length, `Insights ${variation.name}`);
    }
    const stats = await api(`/envs/${env.id}/experiment-stats/query`, {
      flagKey: flag.key, metricEvent: eventName, metricType: 'numeric', metricAgg: 'sum',
      startDate: new Date(from).toISOString().slice(0, 10), endDate: new Date(to).toISOString().slice(0, 10),
      startTime: new Date(from).toISOString(), endTime: new Date(to).toISOString(),
    });
    evidence.stats = stats;
    assert.equal(stats.variants.length, 2);
    for (const variation of variations) {
      const items = expected.filter(x => x.variation.id === variation.id);
      const actual = stats.variants.find(x => x.variant === variation.id);
      assert.ok(actual, `Stats ${variation.name}`);
      assert.equal(Number(actual.users), items.length);
      assert.equal(Number(actual.conversions), items.length);
      assert.equal(actual.sumValue, items.reduce((sum, x) => sum + x.numericValue, 0));
    }
    evidence.success = true;
    console.log(`[PASS] ${stack.name}: ${expected.length} exposures + ${expected.length} metrics; persistence, insights and metric statistics match.\nManual UI: ${evidence.ui}`);
  } catch (error) {
    evidence.success = false;
    evidence.error = error.stack;
    throw error;
  } finally {
    await stack.save(`${runId}.json`, evidence);
    await logs(stack);
  }
}
