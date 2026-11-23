import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { dotnetBuildEnv, processRun, ready, stopStack, waitFor } from './stack.mjs';

test('waitFor bounds a callback that never settles and keeps a standalone process alive', async () => {
  const module = new URL('./stack.mjs', import.meta.url).href;
  const script = `
    import { waitFor } from ${JSON.stringify(module)};
    try {
      await waitFor('stalled callback', () => new Promise(() => {}), 30);
      process.exitCode = 1;
    } catch (error) {
      console.log(error.message);
    }
  `;
  const output = await processRun(process.execPath, ['--input-type=module', '-e', script], { quiet: true, timeout: 5000 });
  assert.match(output, /stalled callback timed out: Operation did not settle/);
});

test('waitFor preserves non-retryable errors', async () => {
  const error = Object.assign(new Error('terminal'), { retryable: false });
  await assert.rejects(waitFor('terminal', () => { throw error; }), actual => actual === error);
});

test('readiness retries startup disconnects and unhealthy responses, draining bodies', async () => {
  let attempts = 0;
  const paths = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    if (++attempts === 1) return request.socket.destroy();
    response.writeHead(attempts === 2 ? 503 : 200);
    response.write('starting');
    setTimeout(() => response.end(' done'), 5);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await ready({ api: base, els: base, ui: base }, { timeout: 3000, requestTimeout: 1000, interval: 5 });
    assert.equal(attempts, 5);
    assert.deepEqual(paths, ['/health/readiness', '/health/readiness', '/health/readiness', '/health/readiness', '/health']);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('readiness bounds stalled response bodies and aborts requests', async () => {
  let attempts = 0;
  const server = createServer((request, response) => {
    attempts++;
    response.writeHead(200);
    response.write('never finished');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(ready({ api: base, els: base, ui: base },
      { timeout: 200, requestTimeout: 30, interval: 5 }), /health\/readiness timed out/);
    assert.ok(attempts > 1, 'Stalled requests should be aborted and retried');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('readiness times out even when fetch never settles or responds to abort', async () => {
  const module = new URL('./stack.mjs', import.meta.url).href;
  const script = `
    import { ready } from ${JSON.stringify(module)};
    let attempts = 0;
    globalThis.fetch = () => { attempts++; return new Promise(() => {}); };
    try {
      await ready({ api: 'http://api', els: 'http://els', ui: 'http://ui' },
        { timeout: 150, requestTimeout: 20, interval: 5 });
      process.exitCode = 1;
    } catch (error) {
      if (attempts < 2) throw new Error('Request timeout did not retry');
      console.log(error.message);
    }
  `;
  const output = await processRun(process.execPath, ['--input-type=module', '-e', script], { quiet: true, timeout: 5000 });
  assert.match(output, /http:\/\/api\/health\/readiness timed out/);
});

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

test('dotnet image builds use the shared modules context only when the source has central package versions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'featbit-layout-'));
  try {
    assert.deepEqual(dotnetBuildEnv(root), {
      API_BUILD_CONTEXT: '../../modules/back-end', API_DOCKERFILE: 'deploy/Dockerfile',
      ELS_BUILD_CONTEXT: '../../modules/evaluation-server', ELS_DOCKERFILE: 'deploy/Dockerfile',
    });
    await mkdir(join(root, 'modules'));
    await writeFile(join(root, 'modules', 'Directory.Packages.props'), '<Project />');
    assert.deepEqual(dotnetBuildEnv(root), {});
  } finally { await rm(root, { recursive: true, force: true }); }
});
