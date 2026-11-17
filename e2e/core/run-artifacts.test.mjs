import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRun, runPath } from './run-artifacts.mjs';
import { openStack, initDbs } from './stack.mjs';

test('archives use UTC and preserve evidence when the same tag is run again in the same second', async () => {
  const root = await mkdtemp(join(tmpdir(), 'featbit-archives-'));
  try {
    const now = new Date('2026-10-17T14:30:25+08:00');
    const first = await createRun(root, '6.0.0', now);
    await writeFile(join(first.path, 'suite-results.json'), 'original');
    const second = await createRun(root, '6.0.0', now);
    assert.equal(first.id, '6.0.0-20261017-063025');
    assert.equal(second.id, '6.0.0-20261017-063025-2');
    assert.equal(await readFile(join(first.path, 'suite-results.json'), 'utf8'), 'original');
    const info = JSON.parse(await readFile(join(first.path, 'run.json'), 'utf8'));
    assert.equal(info.timezone, 'UTC');
    assert.equal(info.imageVersion, '6.0.0');
    assert.equal(info.startedAt, '2026-10-17T06:30:25.000Z');
    assert.equal(runPath(root, first.id), first.path);
    const local = await createRun(root, null, now);
    assert.equal(local.id, 'local-20261017-063025');
    await assert.rejects(createRun(root, '../escape', now), /Invalid/);
    assert.throws(() => runPath(root, '../escape'), /Invalid/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('new archives reuse retained initialization state without replaying database scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'featbit-retained-'));
  try {
    const firstRun = await createRun(root, '6.0.0');
    const first = await openStack('postgres', { runsRoot: root, runId: firstRun.id, imageVersion: '6.0.0' });
    first.compose = async args => args[0] === 'ps' ? 'same-container' : '';
    let executions = 0;
    first.exec = async () => { executions++; return ''; };
    await initDbs(first);
    assert.ok(executions > 0);
    const marker = await readFile(join(first.state, 'postgres-init.json'), 'utf8');
    const summary = JSON.parse(await readFile(join(first.artifacts, 'postgres-init-scripts.json'), 'utf8'));
    assert.equal(summary.status, 'ready');
    assert.deepEqual(summary.scripts.map(script => script.name), JSON.parse(marker).scripts);
    assert.ok(summary.scripts.every(script => script.status === 'passed'));
    await first.save('services.log', 'first run');
    const secondRun = await createRun(root, '6.0.1');
    const second = await openStack('postgres', { runsRoot: root, runId: secondRun.id, imageVersion: '6.0.1' });
    second.compose = first.compose;
    second.exec = async () => { throw Error('Initialization was replayed'); };
    await initDbs(second);
    const reused = JSON.parse(await readFile(join(second.artifacts, 'postgres-init-scripts.json'), 'utf8'));
    assert.equal(reused.status, 'reused');
    await second.save('services.log', 'second run');
    assert.equal(first.state, second.state);
    assert.equal(first.state, join(root, 'state', 'postgres'));
    assert.notEqual(first.artifacts, second.artifacts);
    assert.equal(await readFile(join(first.artifacts, 'services.log'), 'utf8'), 'first run');
    assert.equal(await readFile(join(first.state, 'postgres-init.json'), 'utf8'), marker);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
