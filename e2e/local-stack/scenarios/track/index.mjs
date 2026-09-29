import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { waitFor, logs, workspaceId } from '../../stack.mjs';

async function events(stack, envId, runId, kind) {
  assert.match(envId, /^[0-9a-f-]{36}$/i);
  const exposure = kind === 'exposure';
  const table = `experiment_${kind}_events`;
  if (stack.olap === 'Postgres') {
    const output = await stack.exec('postgres', ['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'featbit', '-At', '-c',
      `SELECT json_build_object('userKey', user_key, '${exposure ? 'variationId' : 'eventName'}', ${exposure ? 'variation_id' : 'event_name'}) FROM ${table} WHERE env_id='${envId}' AND user_key LIKE '${runId}-%'`]);
    return output ? output.split(/\r?\n/).map(JSON.parse) : [];
  }
  if (stack.olap === 'MongoDb') {
    const output = await stack.exec('mongodb', ['mongosh', '--quiet', '-u', 'admin', '-p', 'local-stack-only', '--authenticationDatabase', 'admin', '--eval',
      `const d=db.getSiblingDB('featbit'); print(JSON.stringify(d.${exposure ? 'ExperimentExposureEvents' : 'ExperimentMetricEvents'}.find({envId:UUID('${envId}'),userKey:/^${runId}-/}).toArray().map(x=>({userKey:x.userKey,${exposure ? 'variationId:x.variationId' : 'eventName:x.eventName'}}))))`]);
    return JSON.parse(output);
  }
  const output = await stack.exec('clickhouse', ['clickhouse-client', '--password', 'local-stack-only', '--query',
    `SELECT user_key AS userKey, ${exposure ? 'variation_id AS variationId' : 'event_name AS eventName'} FROM featbit.${table} WHERE env_id='${envId}' AND startsWith(user_key, '${runId}-') FORMAT JSONEachRow`]);
  return output ? output.split(/\r?\n/).map(JSON.parse) : [];
}

export async function testTrack(stack) {
  const runId = `track-${randomUUID()}`;
  const evidence = { runId, scenario: stack.name, startedAt: new Date().toISOString() };
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
    const organization = (await api('/organizations')).find(x => x.key === 'local-stack');
    assert.ok(organization?.initialized, 'Initialized Local Stack organization missing');
    headers.Organization = organization.id;
    const project = (await api('/projects')).find(x => x.key === 'integration-tests');
    assert.ok(project, 'Integration Tests project missing');
    const env = project.environments.find(x => x.key === 'dev');
    assert.ok(env, 'Integration Tests project must have a Dev environment');
    const secret = env.secrets.find(x => x.type === 'server')?.value;
    assert.ok(secret, 'Server SDK key missing');
    const flag = await api(`/envs/${env.id}/feature-flags/boolean-flag`);
    const variations = ['Control', 'Treatment'].map(name => {
      const variation = flag.variations.find(x => x.name === name);
      assert.ok(variation, `${name} variation missing`);
      return variation;
    });
    evidence.ui = `${stack.ui}/en/feature-flags/${flag.key}/insights`;
    const timestamp = Math.floor((Date.now() - 60_000) / 1000) * 1000 + 123;
    const insightsPath = `/envs/${env.id}/feature-flags/insights?${new URLSearchParams({
      featureFlagKey: flag.key, intervalType: 'MINUTE', from: String(timestamp - 1000), to: String(timestamp + 5000),
    })}`;
    const before = await api(insightsPath);
    const user = name => ({ keyId: `${runId}-${name}`, name: `Track ${name}`, customizedProperties: [] });
    const variation = selected => [{ featureFlagKey: flag.key,
      variation: { id: selected.id, value: selected.value }, timestamp }];
    const metric = name => [{ type: 'Custom', eventName: `${runId.replaceAll('-', '_')}_${name}`,
      numericValue: 1, timestamp }];
    const cases = [
      { name: 'user', insight: { user: user('user') } },
      { name: 'variation', insight: { user: user('variation'), variations: variation(variations[0]) } },
      { name: 'metric', insight: { user: user('metric'), metrics: metric('metric') } },
      { name: 'combined', insight: { user: user('combined'), variations: variation(variations[1]), metrics: metric('combined') } },
    ];
    evidence.cases = cases;
    for (const { name, insight } of cases) {
      const response = await fetch(`${stack.els}/api/public/insight/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: secret },
        body: JSON.stringify([insight]), signal: AbortSignal.timeout(30_000),
      });
      const body = await response.text();
      assert.equal(response.status, 200, `Track ${name}: ${body}`);
    }
    await waitFor('Track persistence', async () => {
      const users = await api(`/envs/${env.id}/end-users/by-keyIds`, cases.map(x => x.insight.user.keyId));
      const exposureRows = await events(stack, env.id, runId, 'exposure');
      const metricRows = await events(stack, env.id, runId, 'metric');
      evidence.persisted = { users, exposures: exposureRows, metrics: metricRows };
      assert.equal(users.length, 4, 'EndUser count');
      for (const { insight } of cases) {
        assert.ok(users.some(x => x.keyId === insight.user.keyId && x.name === insight.user.name),
          `Stored EndUser ${insight.user.keyId} missing`);
      }
      assert.equal(exposureRows.length, 2, 'Exposure count');
      assert.ok(exposureRows.some(x => x.userKey === `${runId}-variation` && x.variationId === variations[0].id));
      assert.ok(exposureRows.some(x => x.userKey === `${runId}-combined` && x.variationId === variations[1].id));
      assert.equal(metricRows.length, 2, 'Metric count');
      for (const name of ['metric', 'combined']) {
        assert.ok(metricRows.some(x => x.userKey === `${runId}-${name}` && x.eventName === `${runId.replaceAll('-', '_')}_${name}`),
          `Stored ${name} metric missing`);
      }
    }, 120_000);
    const countFor = (values, name) => values.flatMap(x => x.variations)
      .filter(x => x.variation === name).reduce((sum, x) => sum + x.count, 0);
    await waitFor('Insights aggregation', async () => {
      const after = await api(insightsPath);
      evidence.insights = { before, after };
      for (const variation of variations) {
        assert.equal(countFor(after, variation.name) - countFor(before, variation.name), 1,
          `Insights delta ${variation.name}`);
      }
    }, 120_000);
    evidence.success = true;
    console.log(`[PASS] ${stack.name}: EndUser, variation, metric, and combined Track cases persisted; 2 exposures appeared in Insights.\nManual UI: ${evidence.ui}`);
  } catch (error) {
    evidence.success = false;
    evidence.error = error.stack;
    throw error;
  } finally {
    await stack.save(`${runId}.json`, evidence);
    await logs(stack);
  }
}
