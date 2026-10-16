import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processRun } from './stack.mjs';

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
