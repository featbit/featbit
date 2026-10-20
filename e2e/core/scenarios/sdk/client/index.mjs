import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';
import { sdkFixture } from '../fixture.mjs';

const require = createRequire(import.meta.url);
const sdkScript = join(dirname(require.resolve('@featbit/js-client-sdk')),
  '..', 'umd', 'featbit-js-client-sdk.js');

export async function testClientSdk(stack) {
  await sdkFixture(stack, 'client', async ({ flagKey, users, secrets }, verify) => {
    assert.ok(secrets.client, 'Client SDK key missing');
    console.log('[sdk-client] Launching Chromium');
    const browser = await chromium.launch({ headless: true });
    const sessions = {};
    try {
      for (const [index, role] of ['tester', 'guest'].entries()) {
        console.log(`[sdk-client] Initializing ${role} browser session`);
        const context = await browser.newContext();
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/__sdk_live_probe__', route => route.fulfill({
          status: 200, contentType: 'text/html', body: `<!doctype html><html><body>
            <p>update: <output id="all-flags"></output></p>
            <p>update:flagKey: <output id="single-flag"></output></p>
          </body></html>`,
        }));
        await page.goto(`${stack.ui}/__sdk_live_probe__`);
        await page.addScriptTag({ path: sdkScript });
        await page.evaluate(async ({ api, secret, user, flagKey }) => {
          const sdkUser = new window.UserBuilder(user.keyId)
            .name(user.name)
            .custom('role', user.customizedProperties.find(x => x.name === 'role').value)
            .build();
          window.__sdk = new window.FbClientBuilder()
            .sdkKey(secret)
            .streamingUri(api.replace(/^http/, 'ws'))
            .eventsUri(api)
            .user(sdkUser)
            .disableEvents(true)
            .build();
          window.__updates = {};
          const render = (id, payload) => {
            const detail = window.__sdk.stringVariationDetail(flagKey, 'missing');
            document.getElementById(id).textContent = detail.value;
            window.__updates[id] = { payload, detail };
          };
          window.__sdk.on('update', keys => {
            if (keys.includes(flagKey)) render('all-flags', keys);
          });
          window.__sdk.on(`update:${flagKey}`, key => render('single-flag', key));
          await Promise.race([
            window.__sdk.waitForInitialization(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Client SDK ready timed out')), 30_000)),
          ]);
          // Initial rendering is separate from subsequent callback-driven updates.
          for (const id of ['all-flags', 'single-flag']) {
            document.getElementById(id).textContent = window.__sdk.stringVariationDetail(flagKey, 'missing').value;
          }
        }, { api: stack.els, secret: secrets.client, user: users[index], flagKey });
        sessions[role] = { context, page, errors };
        console.log(`[sdk-client] ${role} SDK initialized`);
      }
      await verify(async () => {
        const result = {};
        for (const [role, { page, errors }] of Object.entries(sessions)) {
          assert.deepEqual(errors, [], `${role}: browser errors`);
          result[role] = await page.evaluate(key => ({
            ...window.__sdk.stringVariationDetail(key, 'missing'),
            subscriptions: Object.fromEntries(['all-flags', 'single-flag'].map(id => [id, {
              displayed: document.getElementById(id).textContent, ...window.__updates[id],
            }])),
          }), flagKey);
          assert.notEqual(result[role].value, 'missing', `${role}: fallback returned`);
          assert.equal(result[role].flagKey, flagKey, `${role}: evaluated flag key`);
          assert.equal(result[role].kind, 'Match', `${role}: evaluation kind`);
          assert.ok(result[role].reason, `${role}: evaluation reason missing`);
          for (const [id, subscription] of Object.entries(result[role].subscriptions)) {
            assert.equal(subscription.displayed, result[role].value, `${role}: ${id} displayed value`);
            if (result[role].reason !== 'default') {
              assert.ok(subscription.detail, `${role}: ${id} callback missing`);
            }
            if (subscription.detail) {
              assert.equal(subscription.detail.value, result[role].value, `${role}: ${id} callback value`);
              assert.equal(subscription.detail.reason, result[role].reason, `${role}: ${id} callback reason`);
              if (id === 'all-flags') assert.ok(subscription.payload.includes(flagKey), `${role}: update keys`);
              else assert.equal(subscription.payload, flagKey, `${role}: update flag key`);
            }
          }
        }
        return result;
      });
    } finally {
      console.log('[sdk-client] Closing browser sessions');
      await Promise.all(Object.values(sessions).map(({ page }) => page.evaluate(() => window.__sdk.close()).catch(() => {})));
      await Promise.all(Object.values(sessions).map(({ context }) => context.close()));
      await browser.close();
    }
  });
}
