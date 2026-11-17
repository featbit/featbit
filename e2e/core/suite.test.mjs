import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSuite } from './suite.mjs';
import { scenarios } from './scenarios/index.mjs';

function mockOperations(fault = () => {}) {
  const calls = [];
  const operations = {
    openStack: async (name, options) => {
      calls.push(['open', name, options]);
      fault('open', name);
      return { name };
    },
    prepareStack: async (stack, options) => {
      calls.push(['prepare', stack.name, options]);
      fault('prepare', stack.name);
    },
    runScenario: async (stack, scenario) => {
      calls.push(['test', stack.name, scenario]);
      fault(scenario, stack.name);
    },
    stopStack: async stack => {
      calls.push(['down', stack.name]);
      fault('down', stack.name);
    },
    saveFailure: async (stack, file) => calls.push(['failure', stack.name, file]),
  };
  return { calls, operations };
}

test('suite directly runs all scenarios, builds source once and cleans before opening the next stack', async () => {
  const { calls, operations } = mockOperations();
  const results = await runSuite({ names: ['postgres', 'mongo-redis'], runId: 'local-test' }, operations);
  assert.equal(results.length, 2 * Object.keys(scenarios).length);
  assert.ok(results.every(result => result.passed));
  assert.deepEqual(calls[0], ['open', 'postgres', { imageVersion: undefined, runId: 'local-test' }]);
  assert.deepEqual(calls.filter(call => call[0] === 'prepare'), [
    ['prepare', 'postgres', { build: true, reuse: false }],
    ['prepare', 'mongo-redis', { build: false, reuse: false }],
  ]);
  const next = calls.findIndex(call => call[0] === 'open' && call[1] === 'mongo-redis');
  assert.deepEqual(calls[next - 1], ['down', 'postgres']);
});

test('preparation and scenario failures retain diagnostics, clean up and continue later stacks', async () => {
  const { calls, operations } = mockOperations((phase, name) => {
    if (name === 'postgres' && phase === 'prepare') throw Error('startup failure');
    if (name === 'postgres-redis' && phase === 'track') throw Error('assertion failure');
  });
  const results = await runSuite({ names: ['postgres', 'postgres-redis', 'mongo-redis'], imageVersion: '6.0.1' }, operations);
  assert.equal(results.filter(result => !result.passed).length, 2);
  assert.equal(calls.filter(call => call[0] === 'down').length, 3);
  assert.ok(results.some(result => result.stack === 'postgres-redis' && result.scenario === 'sdk-client' && result.passed));
  assert.ok(results.some(result => result.stack === 'mongo-redis' && result.passed));
  assert.ok(calls.some(call => call[2] === 'track-failure.log'));
  assert.ok(calls.filter(call => call[0] === 'open').every(call => call[2].imageVersion === '6.0.1'));
  assert.ok(calls.filter(call => call[0] === 'prepare').every(call => !call[2].build));
});

test('cleanup failure stops the suite; opening failure cannot clean a different stack', async () => {
  const failedCleanup = mockOperations(phase => { if (phase === 'down') throw Error('daemon unavailable'); });
  const results = await runSuite({ names: ['postgres', 'mongo-redis'] }, failedCleanup.operations);
  assert.equal(results.at(-1).phase, 'cleanup');
  assert.ok(!failedCleanup.calls.some(call => call[1] === 'mongo-redis'));
  const failedOpen = mockOperations(phase => { if (phase === 'open') throw Error('invalid state'); });
  const openResults = await runSuite({ names: ['postgres'] }, failedOpen.operations);
  assert.equal(openResults[0].phase, 'preparation');
  assert.deepEqual(failedOpen.calls.map(call => call[0]), ['open']);
});

test('single scenarios clean up after success, preparation failure and assertion failure', async () => {
  for (const failedPhase of [null, 'prepare', 'sdk-client']) {
    const { calls, operations } = mockOperations(phase => {
      if (phase === failedPhase) throw Error('test failure');
    });
    const results = await runSuite({ names: ['postgres'], scenario: 'sdk-client', build: true }, operations);
    assert.deepEqual(calls.find(call => call[0] === 'prepare')[2], { build: true, reuse: true });
    assert.deepEqual(calls.at(-1), ['down', 'postgres']);
    assert.equal(results.filter(result => !result.passed).length, failedPhase ? 1 : 0);
    assert.ok(calls.filter(call => call[0] === 'test').every(call => call[2] === 'sdk-client'));
  }
});

test('keep-environment skips teardown after success or failure for single scenarios and suites', async () => {
  for (const scenario of [undefined, 'sdk-client']) {
    for (const failedPhase of [null, 'prepare', 'sdk-client']) {
      const { calls, operations } = mockOperations(phase => {
        if (phase === failedPhase) throw Error('test failure');
      });
      const results = await runSuite({ names: ['postgres'], scenario, keepEnvironment: true }, operations);
      assert.ok(!calls.some(call => call[0] === 'down'));
      assert.equal(results.filter(result => !result.passed).length, failedPhase ? 1 : 0);
    }
  }
});
