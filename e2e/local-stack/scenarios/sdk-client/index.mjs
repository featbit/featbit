import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';
import { sdkFixture } from '../shared/sdk-fixture.mjs';

const require = createRequire(import.meta.url);
const sdkScript = join(dirname(require.resolve('featbit-js-client-sdk/package.json')),
  'umd', 'featbit-js-client-sdk.js');

export async function testClientSdk(stack) {
  await sdkFixture(stack, 'client', async ({ flagKey, users, secrets }, verify) => {
    assert.ok(secrets.client, 'Client SDK key missing');
    const browser = await chromium.launch({ headless: true });
    const sessions = {};
    try {
      for (const [index, role] of ['tester', 'guest'].entries()) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/__sdk_live_probe__', route => route.fulfill({
          status: 200, contentType: 'text/html', body: '<!doctype html><html><body>SDK probe</body></html>',
        }));
        await page.goto(`${stack.ui}/__sdk_live_probe__`);
        await page.addScriptTag({ path: sdkScript });
        await page.evaluate(async ({ api, secret, user }) => {
          window.__sdk = window.fbClient;
          await window.__sdk.init({ api, secret, user });
          await Promise.race([
            window.__sdk.waitUntilReady(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Client SDK ready timed out')), 30_000)),
          ]);
        }, { api: stack.els, secret: secrets.client, user: users[index] });
        sessions[role] = { context, page, errors };
      }
      await verify(async () => {
        const result = {};
        for (const [role, { page, errors }] of Object.entries(sessions)) {
          assert.deepEqual(errors, [], `${role}: browser errors`);
          result[role] = { value: await page.evaluate(key => window.__sdk.variation(key, 'missing'), flagKey) };
          assert.notEqual(result[role].value, 'missing', `${role}: fallback returned`);
        }
        return result;
      });
    } finally {
      await Promise.all(Object.values(sessions).map(({ context }) => context.close()));
      await browser.close();
    }
  });
}
