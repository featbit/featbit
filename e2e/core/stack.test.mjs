import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processRun, stopStack } from './stack.mjs';

test('successful teardown removes stack state and its empty directory, preserving parent and evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'featbit-teardown-'));
  try {
    const state = join(root, 'state', 'postgres');
    await mkdir(state, { recursive: true });
    await writeFile(join(state, 'environment.json'), 'settings');
    await writeFile(join(state, 'postgres-init.json'), 'marker');
    await mkdir(join(root, 'state', 'mongo-redis'));
    await writeFile(join(root, 'evidence.json'), 'evidence');
    const calls = [];
    await stopStack({ state, artifacts: root, compose: async args => { calls.push(args); } });
    assert.deepEqual(calls.at(-1), ['down', '--volumes', '--remove-orphans']);
    await assert.rejects(readdir(state), { code: 'ENOENT' });
    assert.deepEqual(await readdir(join(root, 'state')), ['mongo-redis']);
    assert.equal(await readFile(join(root, 'evidence.json'), 'utf8'), 'evidence');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed teardown retains state and can be retried successfully', async () => {
  const root = await mkdtemp(join(tmpdir(), 'featbit-teardown-failure-'));
  try {
    const state = join(root, 'postgres');
    await mkdir(state);
    await writeFile(join(state, 'environment.json'), 'settings');
    await writeFile(join(state, 'postgres-init.json'), 'marker');
    const failure = Error('Docker teardown failed');
    await assert.rejects(stopStack({ state, artifacts: root, compose: async args => {
      if (args[0] === 'down') throw failure;
    } }), error => error === failure);
    assert.equal(await readFile(join(state, 'environment.json'), 'utf8'), 'settings');
    assert.equal(await readFile(join(state, 'postgres-init.json'), 'utf8'), 'marker');
    await stopStack({ state, artifacts: root, compose: async () => {} });
    await assert.rejects(readdir(state), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('file-backed command output is streamed and only a bounded tail is retained', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'featbit-output-'));
  try {
    const file = join(folder, 'services.log');
    const script = 'process.stdout.write("x".repeat(1024 * 1024)); process.stderr.write("y".repeat(1024 * 1024))';
    const output = await processRun(process.execPath, ['-e', script], { quiet: true, logPath: file });
    const saved = await readFile(file);
    assert.equal(saved.length, 2 * 1024 * 1024);
    assert.equal(output, 'x'.repeat(64 * 1024));
    assert.ok(saved.includes(Buffer.from('y'.repeat(1024))));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('file-backed command failure includes only a bounded diagnostic tail', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'featbit-error-'));
  try {
    const file = join(folder, 'build.log');
    const script = 'process.stderr.write("z".repeat(1024 * 1024)); process.exitCode = 1';
    await assert.rejects(processRun(process.execPath, ['-e', script], { quiet: true, logPath: file }), error => {
      assert.match(error.message, /exited 1/);
      assert.ok(error.message.length < 70 * 1024);
      return true;
    });
    assert.equal((await readFile(file)).length, 1024 * 1024);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
