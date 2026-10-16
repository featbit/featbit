import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { configPath } from './config.mjs';
import { directory, stacks } from './stack.mjs';
import { scenarios } from './scenarios/index.mjs';

export async function runSuite(names, run, imageVersion) {
  const results = [];
  for (const [index, name] of names.entries()) {
    let cleaned = true;
    let configured = false;
    try {
      await run(['setup', '--stack', name, ...(imageVersion ? ['--image-version', imageVersion] : ['--local'])]);
      configured = true;
      await run(['up', ...(!imageVersion && index === 0 ? ['--build'] : [])]);
      for (const scenario of Object.keys(scenarios)) {
        try {
          await run(['test', '--scenario', scenario]);
          results.push({ stack: name, scenario, passed: true });
        } catch (error) {
          results.push({ stack: name, scenario, passed: false, error: error.message });
        }
      }
    } catch (error) {
      results.push({ stack: name, phase: 'preparation', passed: false, error: error.message });
    } finally {
      try { if (configured) await run(['down']); }
      catch (error) {
        cleaned = false;
        results.push({ stack: name, phase: 'cleanup', passed: false, error: error.message });
      }
    }
    if (!cleaned) break;
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  let imageVersion, stack, local = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--image-version' && !imageVersion && args[i + 1] && !args[i + 1].startsWith('--')) imageVersion = args[++i];
    else if (args[i] === '--stack' && !stack && args[i + 1] && !args[i + 1].startsWith('--')) stack = args[++i];
    else if (args[i] === '--local' && !local) local = true;
    else throw Error('Usage: npm run test:all -- (--image-version TAG | --local) [--stack NAME]');
  }
  if ((local === Boolean(imageVersion)) || (imageVersion && !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(imageVersion)) ||
      (stack !== undefined && !Object.hasOwn(stacks, stack))) throw Error('Select --image-version TAG or --local and a valid stack');
  let saved;
  try { saved = await readFile(configPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const run = args => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(directory, 'cli.mjs'), ...args],
      { cwd: directory, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(Error(`${args.join(' ')} exited ${code}`)));
  });
  try {
    const results = await runSuite(stack ? [stack] : Object.keys(stacks), run, imageVersion);
    await mkdir(join(directory, '.runs'), { recursive: true });
    await writeFile(join(directory, '.runs', 'suite-results.json'), JSON.stringify(results, null, 2));
    for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.stack}/${result.scenario ?? result.phase}${result.error ? `: ${result.error}` : ''}`);
    const failures = results.filter(result => !result.passed).length;
    console.log(`${results.length - failures} passed, ${failures} failed`);
    if (failures) process.exitCode = 1;
  } finally {
    if (saved) await writeFile(configPath, saved);
    else await unlink(configPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
