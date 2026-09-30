import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { initDbs, logs, openStack, processRun, ready, stacks } from './stack.mjs';
import { ensureBusinessData } from './bootstrap/index.mjs';
import { scenarios } from './scenarios/index.mjs';
import { readConfig, saveConfig, printConfig } from './config.mjs';

const [command, ...args] = process.argv.slice(2);
const usage = 'Usage: node cli.mjs setup [--stack NAME] [--image-version TAG | --local] | config | up [--no-build] | test --scenario NAME [--all] [--one-time] | logs | down [--all]';
let stackName, scenario, selectedVersion, local = false, all = false, noBuild = false, oneTime = false;
if (!['setup', 'config', 'up', 'test', 'logs', 'down'].includes(command)) throw new Error(usage);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--stack' && !stackName && args[i + 1] && !args[i + 1].startsWith('--')) stackName = args[++i];
  else if (arg === '--scenario' && !scenario && args[i + 1] && !args[i + 1].startsWith('--')) scenario = args[++i];
  else if (arg === '--image-version' && !selectedVersion && args[i + 1] && !args[i + 1].startsWith('--')) selectedVersion = args[++i];
  else if (arg === '--local' && !local) local = true;
  else if (arg === '--all' && !all) all = true;
  else if (arg === '--one-time' && !oneTime) oneTime = true;
  else if (arg === '--no-build' && !noBuild) noBuild = true;
  else throw new Error(usage);
}
if ((command !== 'setup' && (stackName !== undefined || selectedVersion !== undefined || local)) ||
    (local && selectedVersion !== undefined) || (all && !['test', 'down'].includes(command)) ||
    (oneTime && command !== 'test') ||
    (command === 'test' ? !Object.hasOwn(scenarios, scenario) : scenario !== undefined) ||
    (noBuild && command !== 'up')) throw new Error(usage);
if (command === 'setup' || command === 'config') {
  const changes = {};
  if (stackName !== undefined) changes.stack = stackName;
  if (selectedVersion !== undefined || local) changes.imageVersion = local ? null : selectedVersion;
  printConfig(Object.keys(changes).length ? await saveConfig(changes) : await readConfig());
  process.exit(0);
}
const { config } = await readConfig();
const imageVersion = config.imageVersion;
const names = all ? Object.keys(stacks) : [config.stack];
let localImagesBuilt = false;
async function startStack(stack) {
  await initDbs(stack);
  if (stack.localServices.length && !noBuild && !localImagesBuilt) {
    console.log(`Building local source; log: ${join(stack.artifacts, 'build.log')}`);
    await stack.compose(['build', ...stack.localServices], { timeout: 1_800_000, quiet: true, logPath: join(stack.artifacts, 'build.log') });
    localImagesBuilt = true;
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
async function stopStack(stack) {
  await logs(stack).catch(error => console.warn(`Could not save service logs: ${error.message}`));
  await stack.compose(['down', '--volumes', '--remove-orphans']);
  // Remove only this scenario's known state files; preserve test evidence and logs.
  for (const file of await readdir(stack.artifacts)) {
    if (['environment.json', 'postgres-init.json', 'mongodb-init.json', 'clickhouse-init.json'].includes(file)) {
      await unlink(join(stack.artifacts, file));
    }
  }
}
for (const name of names) {
  let stack = await openStack(name, { imageVersion });
  console.log(`[${command === 'test' ? `test:${scenario}` : command}] ${name} (${stack.project}) | images: ${imageVersion ? `published ${imageVersion}` : 'local'}`);
  try {
    if (command === 'up') await startStack(stack);
    if (command === 'test') {
      const requiredServices = [...stack.services, 'api', 'els', 'ui'];
      const running = await stack.compose(['ps', '--status', 'running', '-q', ...requiredServices], { quiet: true });
      const containerIds = running.split(/\r?\n/).filter(Boolean);
      let available = containerIds.length === requiredServices.length;
      if (available) {
        const actualImages = await processRun('docker', ['inspect', '--format', '{{.Config.Image}}', ...containerIds], { quiet: true });
        const imageSet = new Set(actualImages.split(/\r?\n/).filter(Boolean));
        available = stack.expectedApplicationImages.every(image => imageSet.has(image));
      }
      if (!available) {
        console.log(`[test] Preparing ${name}${imageVersion ? ` with image version ${imageVersion}` : ''}`);
        await startStack(stack);
      } else {
        await ready(stack);
        await ensureBusinessData(stack);
      }
      await scenarios[scenario](stack);
    }
    if (command === 'logs') await logs(stack);
    if (command === 'down') await stopStack(stack);
  } catch (error) {
    await stack.save('failure.log', error.stack ?? String(error));
    await logs(stack).catch(() => {});
    console.error(error.message);
    console.error(`${oneTime ? 'Cleanup will be attempted.' : 'Environment retained.'} Evidence: ${stack.artifacts}`);
    process.exitCode = 1;
  } finally {
    if (oneTime) {
      try {
        await stopStack(stack);
        console.log(`[down] ${name}: services and test data volumes removed`);
      } catch (error) {
        console.error(`Cleanup failed for ${name}: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
  if (process.exitCode) break;
}
