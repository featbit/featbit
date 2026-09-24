import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const directory = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
export const scenarios = {
  postgres: ['Postgres', 'Postgres', 'None', 'Postgres', ['postgres']],
  'postgres-redis': ['Postgres', 'Redis', 'Redis', 'Postgres', ['postgres', 'redis']],
  'mongo-redis': ['MongoDb', 'Redis', 'Redis', 'MongoDb', ['mongodb', 'redis']],
  'postgres-kafka-clickhouse': ['Postgres', 'Kafka', 'Redis', 'ClickHouse', ['postgres', 'redis', 'kafka', 'clickhouse']],
  'mongo-kafka-clickhouse': ['MongoDb', 'Kafka', 'Redis', 'ClickHouse', ['mongodb', 'redis', 'kafka', 'clickhouse']],
};

export async function processRun(command, args, { input, env, quiet = false, logPath, timeout = 600_000 } = {}) {
  return new Promise((resolve, reject) => {
    const log = logPath ? createWriteStream(logPath) : null;
    log?.on('error', reject);
    const child = spawn(command, args, { cwd: directory, env: env ?? process.env, shell: false,
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${command} ${args[0]} timed out`)); }, timeout);
    child.stdout.on('data', value => { stdout += value; log?.write(value); if (!quiet) process.stdout.write(value); });
    child.stderr.on('data', value => { stderr += value; log?.write(value); if (!quiet) process.stderr.write(value); });
    child.stdin.on('error', () => {});
    child.on('error', error => { clearTimeout(timer); log?.end(); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      log?.end();
      code === 0 ? resolve(stdout.trim()) : reject(new Error(`${command} ${args[0]} exited ${code}\n${stderr}\n${stdout}`));
    });
    child.stdin.end(input);
  });
}

export async function openStack(name) {
  if (!Object.hasOwn(scenarios, name)) throw new Error(`Unknown scenario ${name}; use ${Object.keys(scenarios).join(', ')}`);
  const [db, mq, cache, olap, services] = scenarios[name];
  const index = Object.keys(scenarios).indexOf(name);
  const project = `featbit-local-${name}`;
  const artifacts = join(directory, '.runs', name);
  await mkdir(artifacts, { recursive: true });
  const configPath = join(artifacts, 'environment.json');
  let env;
  try { env = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    env = { STACK_PROJECT: project, DB_PROVIDER: db, MQ_PROVIDER: mq, CACHE_PROVIDER: cache,
      OLAP_PROVIDER: olap, API_PORT: String(15000 + index * 10), ELS_PORT: String(15001 + index * 10),
      UI_PORT: String(15002 + index * 10) };
    for (const key of ['API_PORT', 'ELS_PORT', 'UI_PORT', 'POSTGRES_IMAGE', 'MONGO_IMAGE', 'REDIS_IMAGE', 'KAFKA_IMAGE', 'CLICKHOUSE_IMAGE']) {
      if (process.env[key]) env[key] = process.env[key];
    }
    await writeFile(configPath, JSON.stringify(env, null, 2));
  }
  const profiles = services.map(s => s === 'mongodb' ? 'mongo' : s).join(',');
  const compose = (args, options = {}) => processRun('docker', ['compose', '-p', project, '-f', join(directory, 'compose.yaml'), ...args],
    { ...options, env: { ...process.env, ...env, COMPOSE_PROFILES: profiles } });
  const exec = (service, args, input) => compose(['exec', '-T', service, ...args], { input, quiet: true, timeout: 120_000 });
  const save = (name, value) => writeFile(join(artifacts, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  return { name, project, artifacts, db, mq, olap, services, env, compose, exec, save,
    api: `http://127.0.0.1:${env.API_PORT}`, els: `http://127.0.0.1:${env.ELS_PORT}`, ui: `http://localhost:${env.UI_PORT}` };
}

export async function initDbs(stack) {
  await stack.compose(['up', '-d', '--wait', '--wait-timeout', '180', ...stack.services]);
  if (stack.mq === 'Kafka') {
    for (const topic of ['featbit-feature-flag-change', 'featbit-segment-change', 'featbit-endusers', 'featbit-insights', 'featbit-usage', 'featbit-control-plane-web-hooks']) {
      await stack.exec('kafka', ['/opt/bitnami/kafka/bin/kafka-topics.sh', '--create', '--if-not-exists', '--bootstrap-server', 'kafka:9092', '--partitions', '1', '--replication-factor', '1', '--topic', topic]);
    }
  }
  for (const service of stack.services.filter(x => ['postgres', 'mongodb', 'clickhouse'].includes(x))) {
    const folder = join(root, 'infra', service === 'postgres' ? 'postgresql' : service, 'docker-entrypoint-initdb.d');
    const extension = service === 'mongodb' ? 'js' : 'sql';
    const names = (await readdir(folder)).filter(x => new RegExp(`^v\\d+\\.\\d+\\.\\d+\\.${extension}$`).test(x))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    if (!names.length) throw new Error(`No versioned init scripts in ${folder}`);
    const scripts = await Promise.all(names.map(async name => ({ name, text: await readFile(join(folder, name), 'utf8') })));
    const hash = createHash('sha256').update(JSON.stringify(scripts)).digest('hex');
    const markerPath = join(stack.artifacts, `${service}-init.json`);
    const container = await stack.compose(['ps', '-q', service], { quiet: true });
    let marker;
    try { marker = JSON.parse(await readFile(markerPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (marker) {
      if (marker.hash === hash && marker.container === container && marker.status === 'ready') continue;
      throw new Error(`${service} init state or scripts changed. Use npm run down -- --scenario ${stack.name}, then init_dbs. Initialization is never replayed over an existing database.`);
    }
    await stack.save(`${service}-init.json`, { hash, container, status: 'initializing' });
    for (const script of scripts) {
      console.log(`[init_dbs] ${service}: ${script.name}`);
      let output;
      if (service === 'postgres') output = await stack.exec(service, ['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', script.name === 'v0.0.0.sql' ? 'postgres' : 'featbit'], script.text);
      else if (service === 'mongodb') {
        // --file makes JavaScript exceptions fatal, unlike an interactive shell fed on stdin.
        await stack.exec(service, ['sh', '-c', 'cat > /tmp/featbit-init.js'], script.text);
        output = await stack.exec(service, ['mongosh', '--quiet', '-u', 'admin', '-p', 'local-stack-only', '--authenticationDatabase', 'admin', '--file', '/tmp/featbit-init.js']);
      } else output = await stack.exec(service, ['clickhouse-client', '--password', 'local-stack-only', '--multiquery'], script.text);
      await stack.save(`${service}-${script.name}.log`, output);
    }
    await stack.save(`${service}-init.json`, { hash, container, status: 'ready', scripts: names });
  }
}

export async function waitFor(label, fn, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { return await fn(); } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} timed out: ${last?.message}`);
}

export async function ready(stack) {
  for (const base of [stack.api, stack.els]) await waitFor(base, async () => {
    const response = await fetch(`${base}/health/readiness`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });
  await waitFor(stack.ui, async () => {
    const response = await fetch(`${stack.ui}/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });
}

export async function logs(stack) {
  await stack.save('services.log', await stack.compose(['logs', '--no-color'], { quiet: true }));
}
