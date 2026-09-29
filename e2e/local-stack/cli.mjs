import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { initDbs, logs, matchesImageVersion, openStack, processRun, ready, stacks } from './stack.mjs';
import { ensureBusinessData } from './bootstrap/index.mjs';
import { scenarios } from './scenarios/index.mjs';

const [command, ...args] = process.argv.slice(2);
const usage = 'Usage: node cli.mjs up|test|logs|down [--stack NAME | --all] [--scenario NAME] [--image-version TAG] [--no-build]';
let stackName, scenario, imageVersion, all = false, noBuild = false;
if (!['up', 'test', 'logs', 'down'].includes(command)) throw new Error(usage);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--stack' && !stackName && args[i + 1] && !args[i + 1].startsWith('--')) stackName = args[++i];
  else if (arg === '--scenario' && !scenario && args[i + 1] && !args[i + 1].startsWith('--')) scenario = args[++i];
  else if (arg === '--image-version' && !imageVersion && args[i + 1] && !args[i + 1].startsWith('--')) imageVersion = args[++i];
  else if (arg === '--all' && !all) all = true;
  else if (arg === '--no-build' && !noBuild) noBuild = true;
  else throw new Error(usage);
}
if ((all && stackName) || (command === 'test' ? !Object.hasOwn(scenarios, scenario) : scenario !== undefined) ||
    (noBuild && command !== 'up')) throw new Error(usage);
if (imageVersion && !['up', 'test'].includes(command)) throw new Error(usage);
if (imageVersion && !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(imageVersion)) {
  throw new Error(`Invalid image version: ${imageVersion}`);
}
const names = all ? Object.keys(stacks) : [stackName ?? 'postgres'];
async function startStack(stack) {
  await initDbs(stack);
  if (stack.localServices.length && !noBuild) {
    console.log(`Building local source; log: ${join(stack.artifacts, 'build.log')}`);
    await stack.compose(['build', ...stack.localServices], { timeout: 1_800_000, quiet: true, logPath: join(stack.artifacts, 'build.log') });
  }
  for (const service of stack.publishedImages) {
    const image = stack.env[`${service.toUpperCase()}_IMAGE`];
    console.log(`Pulling ${service}: ${image}`);
    await processRun('docker', ['pull', image]);
  }
  await stack.compose(['up', '-d', '--no-build', '--pull', 'never', 'api', 'els', 'ui']);
  await ready(stack);
  await ensureBusinessData(stack);
  console.log(`UI: ${stack.ui}\nAPI: ${stack.api}\nELS: ${stack.els}`);
}
for (const name of names) {
  let stack = await openStack(name, { imageVersion: command === 'up' ? imageVersion : undefined });
  console.log(`[${command === 'test' ? `test:${scenario}` : command}] ${name} (${stack.project})`);
  try {
    if (command === 'up') await startStack(stack);
    if (command === 'test') {
      const requiredServices = [...stack.services, 'api', 'els', 'ui'];
      const running = await stack.compose(['ps', '--status', 'running', '-q', ...requiredServices], { quiet: true });
      const containerIds = running.split(/\r?\n/).filter(Boolean);
      let available = containerIds.length === requiredServices.length;
      if (available && imageVersion) {
        available = matchesImageVersion(stack, imageVersion);
        if (available) {
          const actualImages = await processRun('docker', ['inspect', '--format', '{{.Config.Image}}', ...containerIds], { quiet: true });
          const imageSet = new Set(actualImages.split(/\r?\n/).filter(Boolean));
          available = stack.publishedImages.every(service => imageSet.has(stack.env[`${service.toUpperCase()}_IMAGE`]));
        }
      }
      if (!available) {
        console.log(`[test] Preparing ${name}${imageVersion ? ` with image version ${imageVersion}` : ''}`);
        stack = await openStack(name, { imageVersion });
        await startStack(stack);
      } else {
        await ready(stack);
        await ensureBusinessData(stack);
      }
      await scenarios[scenario](stack);
    }
    if (command === 'logs') await logs(stack);
    if (command === 'down') {
      await logs(stack);
      await stack.compose(['down', '--volumes', '--remove-orphans']);
      // Remove only this scenario's known state files; preserve test evidence and logs.
      for (const file of await readdir(stack.artifacts)) {
        if (['environment.json', 'postgres-init.json', 'mongodb-init.json', 'clickhouse-init.json'].includes(file)) {
          await unlink(join(stack.artifacts, file));
        }
      }
    }
  } catch (error) {
    await stack.save('failure.log', error.stack ?? String(error));
    await logs(stack).catch(() => {});
    console.error(error.message);
    console.error(`Environment retained. Evidence: ${stack.artifacts}`);
    process.exitCode = 1;
    break;
  }
}
