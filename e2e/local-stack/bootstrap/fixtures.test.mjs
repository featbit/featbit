import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureFlags, flags } from './flag.mjs';
import { ensureSegment } from './segment.mjs';

test('creates four typed flags once and validates them on reuse', async () => {
  const created = new Map();
  const calls = [];
  const api = async (path, body) => {
    calls.push({ path, body });
    if (body) {
      created.set(body.key, body);
      return body;
    }
    const key = new URL(`http://local${path}`).searchParams.get('name');
    return { items: created.has(key) ? [created.get(key)] : [] };
  };
  const context = { api, environment: { id: 'env-id', key: 'dev' } };
  await ensureFlags(context);
  await ensureFlags(context);
  assert.equal(created.size, 4);
  assert.equal(calls.filter(x => x.body).length, 4);
  for (const fixture of flags) {
    const flag = created.get(fixture.key);
    assert.equal(flag.variationType, fixture.variationType);
    assert.deepEqual(flag.variations.map(x => x.value), fixture.values);
    assert.equal(flag.enabledVariationId, flag.variations[1].id);
    assert.equal(flag.disabledVariationId, flag.variations[0].id);
  }
});

test('creates a Dev-only tester segment with a role property rule once', async () => {
  let segment, targeting;
  const calls = [];
  const api = async (path, body, method) => {
    calls.push({ path, body, method });
    if (method === 'PUT') { targeting = body; return true; }
    if (body) { segment = { ...body, id: 'segment-id' }; return segment; }
    if (path.endsWith('/segment-id')) return { ...segment, rules: targeting.rules };
    return { items: segment ? [segment] : [] };
  };
  const context = {
    api, organization: { key: 'local-stack' }, project: { key: 'integration-tests' }, environment: { id: 'env-id', key: 'dev' },
  };
  await ensureSegment(context);
  await ensureSegment(context);
  assert.equal(calls.filter(x => x.body && x.method !== 'PUT').length, 1);
  assert.equal(calls.filter(x => x.method === 'PUT').length, 1);
  assert.deepEqual(segment.scopes, ['organization/local-stack:project/integration-tests:env/dev']);
  assert.deepEqual(targeting.rules[0].conditions.map(x => ({ property: x.property, op: x.op, value: x.value })),
    [{ property: 'role', op: 'Equal', value: 'tester' }]);
});
