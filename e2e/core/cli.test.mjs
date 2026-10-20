import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs } from './cli.mjs';

test('test and suite accept invocation options including explicit environment retention', () => {
  assert.deepEqual(parseArgs(['test', '--scenario', 'sdk-client']), { command: 'test', scenario: 'sdk-client' });
  assert.equal(parseArgs(['test', '--scenario', 'track', '--stack', 'mongo-redis', '--image-version', '6.0.1']).imageVersion, '6.0.1');
  assert.equal(parseArgs(['test', '--scenario', 'sdk-server', '--local', '--build']).build, true);
  assert.equal(parseArgs(['test-all', '--local', '--stack', 'postgres']).stack, 'postgres');
  assert.equal(parseArgs(['test-all', '--image-version', '6.0.1']).imageVersion, '6.0.1');
  assert.equal(parseArgs(['test', '--scenario', 'track', '--keep-environment']).keepEnvironment, true);
  assert.equal(parseArgs(['test-all', '--local', '--keep-environment']).keepEnvironment, true);
  assert.equal(parseArgs(['down', '--all']).all, true);
  assert.equal(parseArgs(['down', '--stack', 'mongo-redis']).stack, 'mongo-redis');
});

test('removed commands and overlapping or invalid options fail before touching Docker', () => {
  for (const command of ['setup', 'config', 'up', 'logs']) assert.throws(() => parseArgs([command]), /Usage/);
  for (const args of [
    ['test', '--scenario', 'track', '--all'], ['test', '--scenario', 'track', '--one-time'],
    ['test-all'], ['test-all', '--local', '--build'], ['test-all', '--local', '--image-version', '6.0.1'],
    ['test', '--scenario', 'track', '--image-version', 'invalid/tag'],
    ['test', '--scenario', 'track', '--build', '--image-version', '6.0.1'],
    ['test', '--scenario', 'missing'], ['down', '--stack', 'missing'], ['down', '--all', '--stack', 'postgres'],
    ['down', '--image-version', '6.0.1'], ['test', '--scenario', 'track', '--stack'],
    ['down', '--keep-environment'],
  ]) assert.throws(() => parseArgs(args), /Usage/);
});
