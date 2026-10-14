import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { waitFor } from '../../stack.mjs';
import { createProbeReader } from './probe-reader.mjs';

test('a timed-out probe response cannot consume a later retry', async () => {
  const stdout = new PassThrough();
  const stdin = new PassThrough();
  let requests = 0;
  let killed = false;
  stdin.on('data', () => { requests++; });
  const child = {
    stdout, stdin, exitCode: null,
    kill() { killed = true; this.exitCode = 1; },
  };
  const reader = createProbeReader(child, () => '', 20);
  try {
    await assert.rejects(waitFor('probe', () => reader.read(), 1_000), /probe timed out/);
    assert.equal(killed, true);
    stdout.write('late response\n');
    await assert.rejects(reader.read(), /probe timed out/);
    assert.equal(requests, 1, 'waitFor must not send another request after timeout');
  } finally {
    reader.close();
    stdout.destroy();
    stdin.destroy();
  }
});
