import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig, saveConfig } from './config.mjs';

test('configuration defaults, partial updates, and local selection persist correctly', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'featbit-config-'));
  const path = join(folder, 'config.json');
  try {
    assert.deepEqual(await readConfig(path), {
      config: { stack: 'postgres', imageVersion: null }, isDefault: true,
    });
    await saveConfig({ stack: 'mongo-redis', imageVersion: '6.0.0-preview' }, path);
    await saveConfig({ stack: 'postgres-redis' }, path);
    assert.deepEqual((await readConfig(path)).config, { stack: 'postgres-redis', imageVersion: '6.0.0-preview' });
    await saveConfig({ imageVersion: null }, path);
    assert.deepEqual(await readConfig(path), {
      config: { stack: 'postgres-redis', imageVersion: null }, isDefault: false,
    });
    await assert.rejects(saveConfig({ stack: 'unknown' }, path), /Unknown stack/);
    await assert.rejects(saveConfig({ imageVersion: 'invalid/tag' }, path), /Invalid image version/);
    assert.equal((await readConfig(path)).config.imageVersion, null);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
