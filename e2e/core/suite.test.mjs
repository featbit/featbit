import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSuite } from './suite.mjs';
import { scenarios } from './scenarios/index.mjs';

test('suite runs every scenario and cleans each stack before starting the next; source builds once', async () => {
  const calls = [];
  const results = await runSuite(['postgres', 'mongo-redis'], async args => calls.push(args));
  assert.equal(results.length, 2 * Object.keys(scenarios).length);
  assert.ok(results.every(result => result.passed));
  assert.deepEqual(calls[0], ['setup', '--stack', 'postgres', '--local']);
  assert.deepEqual(calls[1], ['up', '--build']);
  const next = calls.findIndex(args => args.includes('mongo-redis'));
  assert.deepEqual(calls[next - 1], ['down']);
  assert.deepEqual(calls[next + 1], ['up']);
});

test('preparation and scenario failures are recorded and later stacks still run', async () => {
  let current;
  const calls = [];
  const results = await runSuite(['postgres', 'postgres-redis', 'mongo-redis'], async args => {
    calls.push(args);
    if (args[0] === 'setup') {
      current = args[2];
      assert.deepEqual(args.slice(3), ['--image-version', '6.0.0']);
    }
    if (current === 'postgres' && args[0] === 'up') throw Error('startup failure');
    if (current === 'postgres-redis' && args[2] === 'track') throw Error('assertion failure');
  }, '6.0.0');
  assert.equal(calls.filter(args => args[0] === 'down').length, 3);
  assert.equal(results.filter(result => !result.passed).length, 2);
  assert.ok(results.some(result => result.stack === 'mongo-redis' && result.passed));
  assert.ok(results.some(result => result.stack === 'postgres-redis' && result.scenario === 'sdk-client' && result.passed));
  assert.ok(!calls.some(args => args.includes('--build')));
});

test('cleanup failure stops before the next stack; setup failure cannot tear down the previously selected stack', async () => {
  const calls = [];
  const results = await runSuite(['postgres', 'mongo-redis'], async args => {
    calls.push(args);
    if (args[0] === 'down') throw Error('daemon unavailable');
  });
  assert.equal(results.at(-1).phase, 'cleanup');
  assert.ok(!calls.some(args => args.includes('mongo-redis')));
  const failedSetup = [];
  await runSuite(['postgres'], async args => { failedSetup.push(args); throw Error('setup failed'); });
  assert.deepEqual(failedSetup.map(args => args[0]), ['setup']);
});
