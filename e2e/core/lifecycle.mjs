import { join } from 'node:path';
import { initDbs, logs, processRun, ready } from './stack.mjs';
import { ensureBusinessData } from './bootstrap/index.mjs';
import { scenarios } from './scenarios/index.mjs';

export async function prepareStack(stack, { build = false, reuse = true } = {}) {
  let available = false;
  if (reuse && !build) {
    const services = [...stack.services, 'api', 'els', 'ui'];
    const running = await stack.compose(['ps', '--status', 'running', '-q', ...services], { quiet: true });
    const ids = running.split(/\r?\n/).filter(Boolean);
    if (ids.length === services.length) {
      const images = await processRun('docker', ['inspect', '--format', '{{.Config.Image}}', ...ids], { quiet: true });
      const actual = new Set(images.split(/\r?\n/).filter(Boolean));
      available = stack.expectedApplicationImages.every(image => actual.has(image));
    }
  }
  if (available) {
    console.log(`[${stack.name}] Reusing running stack; no database initialization scripts executed`);
  } else {
    await initDbs(stack);
    const images = await processRun('docker', ['image', 'ls', '--format', '{{.Repository}}:{{.Tag}}'], { quiet: true });
    const existing = new Set(images.split(/\r?\n/).filter(Boolean));
    const services = stack.localServices.filter(service => build || !existing.has(`featbit-local-${service}:local`));
    if (services.length) {
      console.log(`Building local source; log: ${join(stack.artifacts, 'build.log')}`);
      await stack.compose(['build', ...services], { timeout: 1_800_000, quiet: true, logPath: join(stack.artifacts, 'build.log') });
    }
    for (const service of stack.publishedImages) {
      const image = stack.env[`${service.toUpperCase()}_IMAGE`];
      if (!existing.has(image)) {
        console.log(`Pulling ${service}: ${image}`);
        await processRun('docker', ['pull', image]);
      }
    }
    await stack.compose(['up', '-d', '--no-build', '--pull', 'never', 'api', 'els', 'ui']);
  }
  console.log(`[${stack.name}] Checking service readiness and bootstrap data`);
  await ready(stack);
  await ensureBusinessData(stack);
  console.log(`UI: ${stack.ui}\nAPI: ${stack.api}\nELS: ${stack.els}`);
}

export async function runScenario(stack, name) {
  console.log(`[test:${name}] ${stack.name}: running scenario`);
  await scenarios[name](stack);
}

export async function saveFailure(stack, file, error) {
  console.error(`[${stack.name}] ${error.message}`);
  await stack.save(file, error.stack ?? String(error)).catch(error => console.warn(`Could not save failure: ${error.message}`));
  await logs(stack).catch(error => console.warn(`Could not save logs: ${error.message}`));
}
