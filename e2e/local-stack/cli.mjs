import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { initDbs, logs, openStack, ready, scenarios } from './stack.mjs';
import { testTrack } from './track.mjs';

const [command, ...args] = process.argv.slice(2);
const scenarioIndex = args.indexOf('--scenario');
const names = args.includes('--all') ? Object.keys(scenarios) : [scenarioIndex < 0 ? 'postgres' : args[scenarioIndex + 1]];
if (!['init_dbs', 'up', 'track', 'logs', 'down'].includes(command) ||
    (args.includes('--all') && scenarioIndex >= 0) ||
    args.some((x, i) => x !== '--all' && x !== '--scenario' && !(scenarioIndex >= 0 && i === scenarioIndex + 1) && x !== '--no-build')) {
  throw new Error('Usage: node cli.mjs init_dbs|up|track|logs|down [--scenario NAME | --all] [--no-build]');
}
for (const name of names) {
  const stack = await openStack(name);
  console.log(`[${command}] ${name} (${stack.project})`);
  try {
    if (command === 'init_dbs' || command === 'up') await initDbs(stack);
    if (command === 'up') {
      if (!args.includes('--no-build')) {
        console.log(`Building local source; log: ${join(stack.artifacts, 'build.log')}`);
        await stack.compose(['build', 'api', 'els', 'ui'], { timeout: 1_800_000, quiet: true, logPath: join(stack.artifacts, 'build.log') });
      }
      await stack.compose(['up', '-d', '--no-build', 'api', 'els', 'ui']);
      await ready(stack);
      console.log(`UI: ${stack.ui}\nAPI: ${stack.api}\nELS: ${stack.els}`);
    }
    if (command === 'track') {
      await ready(stack);
      await testTrack(stack);
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
