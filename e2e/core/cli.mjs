import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { cleanupStacks, directory, stacks } from './stack.mjs';
import { scenarios } from './scenarios/index.mjs';
import { createRun } from './run-artifacts.mjs';
import { runSuite } from './suite.mjs';

export function parseArgs([command, ...args]) {
  const usage = 'Usage: test --scenario NAME [--stack NAME] [--local | --image-version TAG] [--build] [--keep-environment] | test-all (--local | --image-version TAG) [--stack NAME] [--keep-environment] | down [--stack NAME | --all]';
  const options = { command };
  if (!['test', 'test-all', 'down'].includes(command)) throw Error(usage);
  const values = { '--stack': 'stack', '--scenario': 'scenario', '--image-version': 'imageVersion' };
  const switches = { '--local': 'local', '--build': 'build', '--keep-environment': 'keepEnvironment', '--all': 'all' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const key = Object.hasOwn(values, arg) ? values[arg] : Object.hasOwn(switches, arg) ? switches[arg] : undefined;
    if (!key || options[key] !== undefined) throw Error(usage);
    if (values[arg]) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(usage);
      options[key] = args[++i];
    } else options[key] = true;
  }
  if ((options.stack && !Object.hasOwn(stacks, options.stack)) ||
      (options.imageVersion && !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(options.imageVersion)) ||
      (options.local && options.imageVersion) || (options.build && options.imageVersion) ||
      (options.all && (command !== 'down' || options.stack)) ||
      (command === 'test' ? !Object.hasOwn(scenarios, options.scenario) : options.scenario !== undefined) ||
      (command === 'test-all' && ((!options.local && !options.imageVersion) || options.build)) ||
      (command === 'down' && (options.local || options.imageVersion || options.build || options.keepEnvironment))) throw Error(usage);
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const archive = await createRun(join(directory, '.runs'), options.imageVersion);
  console.log(`Evidence (UTC): ${archive.path}`);
  const names = options.stack ? [options.stack] : options.command === 'test-all' || options.all ? Object.keys(stacks) : ['postgres'];
  if (options.command === 'down') {
    try { await cleanupStacks(names, archive.id); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
    return;
  }
  const results = await runSuite({ ...options, names, runId: archive.id });
  await writeFile(join(archive.path, 'suite-results.json'), JSON.stringify(results, null, 2));
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.stack}/${result.scenario ?? result.phase}${result.error ? `: ${result.error}` : ''}`);
  const failures = results.filter(result => !result.passed).length;
  console.log(`${results.length - failures} passed, ${failures} failed`);
  if (failures) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
