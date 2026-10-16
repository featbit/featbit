import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureOrganization } from './organization.mjs';

function setup(t, initialized) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    let data;
    if (path.endsWith('/identity/login-by-email')) data = { token: 'test-token' };
    else if (path.endsWith('/organizations')) data = [{ id: 'org-id', key: initialized ? 'local-stack' : 'playground', initialized }];
    else if (path.endsWith('/organizations/onboarding')) data = true;
    else if (path.endsWith('/organizations/org-id')) data = { id: 'org-id', key: 'local-stack', initialized: true };
    else if (path.endsWith('/projects')) data = [{ key: 'integration-tests', environments: [{ key: 'dev' }, { key: 'prod' }] }];
    else throw new Error(`Unexpected API request: ${path}`);
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const stack = {
    name: 'postgres', api: 'http://127.0.0.1:15000', db: 'Postgres',
    exec: async service => {
      assert.equal(service, 'postgres');
      return 'workspace-id';
    },
  };
  return { calls, stack };
}

test('onboards the seeded organization once with a project and environments', async t => {
  const { calls, stack } = setup(t, false);
  await ensureOrganization(stack);
  const onboarding = calls.find(x => x.path.endsWith('/organizations/onboarding'));
  assert.ok(onboarding);
  assert.equal(onboarding.options.method, 'POST');
  assert.equal(onboarding.options.headers.Authorization, 'Bearer test-token');
  assert.equal(onboarding.options.headers.Workspace, 'workspace-id');
  assert.equal(onboarding.options.headers.Organization, 'org-id');
  assert.deepEqual(JSON.parse(onboarding.options.body), {
    organizationName: 'Local Stack', organizationKey: 'local-stack',
    projectName: 'Integration Tests', projectKey: 'integration-tests',
    environments: ['Dev', 'Prod'],
  });
  assert.ok(calls.some(x => x.path.endsWith('/projects')));
});

test('skips onboarding when the organization is initialized', async t => {
  const { calls, stack } = setup(t, true);
  await ensureOrganization(stack);
  assert.ok(calls.some(x => x.path.endsWith('/organizations')));
  assert.ok(!calls.some(x => x.path.endsWith('/organizations/onboarding')));
});
