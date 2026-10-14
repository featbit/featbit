import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { ensureOrganization } from '../../bootstrap/organization.mjs';
import { logs } from '../../stack.mjs';

const check = expect.configure({ timeout: 30_000 });

async function mutation(page, path, method, action) {
  const responsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1${path}` && response.request().method() === method);
  const [response] = await Promise.all([responsePromise, action()]);
  const result = await response.json();
  assert.ok(response.ok() && result.success, `${method} ${path}: HTTP ${response.status()}`);
  return result.data;
}

async function createFlag(page, base, key, name, stringFlag) {
  await page.getByRole('link', { name: 'Feature Flags', exact: true }).click();
  await page.getByRole('button', { name: 'New flag', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New feature flag', exact: true });
  await dialog.locator('#flag-name').fill(name);
  await dialog.locator('#flag-key').fill(key);
  if (stringFlag) {
    await dialog.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: 'STRING', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add variation', exact: true }).click();
    for (const [index, value] of ['easy', 'normal', 'hard'].entries()) {
      await dialog.getByPlaceholder('Name', { exact: true }).nth(index).fill(value);
      await dialog.getByPlaceholder('Value', { exact: true }).nth(index).fill(value);
    }
    await dialog.getByRole('switch').check();
  }
  const flag = await mutation(page, base, 'POST', () =>
    dialog.getByRole('button', { name: 'Create flag', exact: true }).click());
  await check(dialog).not.toBeVisible();
  assert.equal(flag.key, key);
  assert.equal(flag.variationType, stringFlag ? 'string' : 'boolean');
  assert.deepEqual(flag.variations.map(v => v.value).sort(), stringFlag ? ['easy', 'hard', 'normal'] : ['false', 'true']);
  return flag;
}

async function openFlag(page, key, name) {
  await page.getByRole('link', { name: 'Feature Flags', exact: true }).click();
  await page.getByRole('link', { name, exact: true }).click();
  await check(page).toHaveURL(new RegExp(`/feature-flags/${key}/targeting$`));
  await check(page.getByRole('switch', { name: 'Toggle feature flag status' })).toBeVisible();
}

async function toggleFlag(page, base, key, enabled, runId) {
  const toggle = page.getByRole('switch', { name: 'Toggle feature flag status' });
  await toggle.click();
  const dialog = page.getByRole('dialog', { name: enabled ? 'Turn feature flag on?' : 'Turn feature flag off?' });
  await dialog.getByPlaceholder('Feature flag key', { exact: true }).fill(key);
  await dialog.getByRole('textbox', { name: /Change comment/ }).fill(runId);
  await mutation(page, `${base}/${key}/toggle/${enabled}`, 'PUT', () =>
    dialog.getByRole('button', { name: 'Confirm', exact: true }).click());
  await check(dialog).not.toBeVisible();
  await check(toggle).toBeChecked({ checked: enabled });
}

async function setDifficulty(page, base, value, runId) {
  await page.getByRole('combobox', { name: 'Default rule serving variation', exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
  await page.getByRole('button', { name: 'Review & save', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Review targeting changes', exact: true });
  await dialog.getByRole('textbox', { name: /Change comment/ }).fill(runId);
  await mutation(page, `${base}/difficulty-mode/targeting`, 'PUT', () =>
    dialog.getByRole('button', { name: 'Save changes', exact: true }).click());
  await check(dialog).not.toBeVisible();
}

export async function testInteractiveDemo(stack) {
  const runId = `interactive-demo-${randomUUID()}`;
  const evidence = { runId, scenario: 'interactive-demo', stack: stack.name, startedAt: new Date().toISOString(), steps: [] };
  let project, browser, page, demo;
  const secrets = [];
  const redact = text => secrets.reduce((result, secret) => result.replaceAll(secret, '[redacted]'), String(text));
  const step = label => { evidence.steps.push({ label, at: new Date().toISOString() }); console.log(`[interactive-demo] ${label}`); };
  try {
    await ensureOrganization(stack);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto(`${stack.ui}/en/login`);
    await page.getByLabel('Email', { exact: true }).fill('test@featbit.com');
    await page.getByLabel('Password', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/get-started');
    await page.getByRole('banner').getByRole('button', { name: /^(Prod|Dev)$/ }).click();
    await page.getByRole('button', { name: 'Manage environments', exact: true }).click();
    await check(page).toHaveURL(/\/organization\/projects$/);
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    const projectSheet = page.getByRole('dialog', { name: 'Create project', exact: true });
    await projectSheet.locator('#projectName').fill(runId);
    await projectSheet.locator('#projectKey').fill(runId);
    project = await mutation(page, '/projects', 'POST', () =>
      projectSheet.getByRole('button', { name: 'Create project', exact: true }).click());
    await check(projectSheet).not.toBeVisible();
    assert.equal(project.key, runId);
    evidence.projectId = project.id;
    step('Created isolated project through UI');
    const prod = project.environments.find(env => env.key === 'prod');
    assert.ok(prod, 'Isolated project must have Prod');
    secrets.push(...project.environments.flatMap(env => env.secrets.map(secret => secret.value)));
    const clientKey = prod.secrets.find(secret => secret.type === 'client')?.value;
    assert.ok(clientKey, 'Prod client SDK key missing');
    const base = `/envs/${prod.id}/feature-flags`;
    await page.getByRole('banner').getByRole('button', { name: /^(Prod|Dev)$/ }).click();
    await page.getByPlaceholder('Search projects or environments...').fill(runId);
    await page.getByRole('option', { name: 'Prod', exact: true }).click();
    await check(page.getByRole('banner')).toContainText(runId);
    await check(page.getByRole('banner').getByRole('button', { name: 'Prod', exact: true })).toBeVisible();
    step('Logged in and selected isolated Prod');
    await page.getByRole('link', { name: 'Feature Flags', exact: true }).click();
    await createFlag(page, base, 'game-runner', 'game runner', false);
    await createFlag(page, base, 'difficulty-mode', 'difficulty mode', true);
    step('Created both flags through UI');
    await page.getByRole('link', { name: 'Get Started', exact: true }).click();
    const link = page.getByRole('link', { name: 'Try the interactive demo', exact: true });
    await check(link).toBeVisible();
    const url = new URL(await link.getAttribute('href'));
    assert.ok(url.searchParams.get('envKey') === clientKey, 'Demo must use isolated Prod client key');
    const evaluationUrl = new URL(url.searchParams.get('evaluationUrl'));
    const expectedEls = new URL(stack.els);
    assert.ok(['localhost', '127.0.0.1'].includes(evaluationUrl.hostname), 'Demo must connect to local ELS');
    assert.equal(evaluationUrl.port, expectedEls.port, 'Demo ELS port');
    assert.equal(evaluationUrl.protocol, expectedEls.protocol, 'Demo ELS protocol');
    evidence.demoOrigin = url.origin;
    const popup = page.waitForEvent('popup');
    await link.click();
    demo = await popup;
    demo.setDefaultTimeout(30_000);
    await demo.waitForLoadState('domcontentloaded');
    let navigations = 0;
    demo.on('framenavigated', frame => { if (frame === demo.mainFrame()) navigations++; });
    const disabled = demo.getByText('Swith "game-runner" feature flag to ON to release Dino Game', { exact: true });
    await check(demo.getByText('Success ! Now that FeatBit is connected, we can release the Dino Game now.', { exact: true })).toBeVisible();
    await check(disabled).toBeVisible();
    await check(demo.locator('canvas')).toHaveCount(0);
    step('Demo connected; game initially hidden');
    await openFlag(page, 'game-runner', 'game runner');
    await toggleFlag(page, base, 'game-runner', true, runId);
    const mode = value => demo.getByRole('heading', { name: new RegExp(`^Welcome to DINO GAME! Mode Level : ${value}$`, 'i') });
    await check(demo.locator('canvas')).toBeVisible();
    await check(mode('easy')).toBeVisible();
    await check(disabled).not.toBeVisible();
    step('Game enabled: EASY');
    await openFlag(page, 'difficulty-mode', 'difficulty mode');
    for (const value of ['normal', 'hard', 'easy']) {
      await setDifficulty(page, base, value, runId);
      await check(mode(value)).toBeVisible();
      await check(demo.locator('canvas')).toBeVisible();
      step(`Difficulty updated: ${value}`);
    }
    await openFlag(page, 'game-runner', 'game runner');
    await toggleFlag(page, base, 'game-runner', false, runId);
    await check(disabled).toBeVisible();
    await check(demo.locator('canvas')).toHaveCount(0);
    step('Game disabled');
    await toggleFlag(page, base, 'game-runner', true, runId);
    await check(mode('easy')).toBeVisible();
    await check(demo.locator('canvas')).toBeVisible();
    assert.equal(navigations, 0, 'Demo must update without reloading');
    step('Game re-enabled without refreshing demo');
    evidence.checksPassed = true;
    evidence.cleanup = 'pending';
    await page.getByRole('banner').getByRole('button', { name: 'Prod', exact: true }).click();
    await page.getByPlaceholder('Search projects or environments...').fill('integration-tests');
    await page.getByRole('option', { name: 'Prod', exact: true }).click();
    await check(page.getByRole('banner')).not.toContainText(runId);
    await page.getByRole('banner').getByRole('button', { name: 'Prod', exact: true }).click();
    await page.getByRole('button', { name: 'Manage environments', exact: true }).click();
    await check(page).toHaveURL(/\/organization\/projects$/);
    await page.getByPlaceholder('Filter by project name', { exact: true }).fill(runId);
    const projectCard = page.locator('div.overflow-hidden.rounded-md.border.bg-background').filter({ has: page.getByRole('heading', { name: runId, exact: true }) });
    await check(projectCard).toBeVisible();
    await projectCard.getByRole('button', { name: 'Delete project', exact: true }).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Delete project?', exact: true });
    await check(deleteDialog).toContainText(runId);
    assert.equal(await mutation(page, `/projects/${project.id}`, 'DELETE', () =>
      deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click()), true);
    await check(deleteDialog).not.toBeVisible();
    await check(projectCard).toHaveCount(0);
    evidence.cleanup = 'complete';
    evidence.success = true;
    step('Isolated project removed');
  } catch (error) {
    evidence.success = false;
    if (evidence.cleanup === 'pending') evidence.cleanup = 'failed';
    evidence.error = redact(error.stack ?? error);
    for (const [name, target] of [['ui', page], ['demo', demo]]) {
      if (!target || target.isClosed()) continue;
      await target.screenshot({ path: join(stack.artifacts, `${runId}-${name}.png`), fullPage: true }).catch(() => {});
      await stack.save(`${runId}-${name}.txt`, redact(await target.locator('body').ariaSnapshot().catch(() => 'Snapshot unavailable'))).catch(() => {});
    }
    throw new Error(evidence.error);
  } finally {
    await browser?.close().catch(() => {});
    await stack.save(`${runId}.json`, evidence);
    try { await logs(stack); } catch (error) { if (evidence.success) throw error; }
  }
  console.log(`[PASS] ${stack.name}: UI flag creation and interactive demo live updates`);
}
