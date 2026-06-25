import { spawn } from "node:child_process";
import { GenericContainer, Network, Wait } from "testcontainers";

const POSTGRES_PORT = 5432;
const API_PORT = 5000;
const postgresImage = process.env.FEATBIT_E2E_POSTGRES_IMAGE ?? "postgres:16-alpine";
const apiImage = process.env.FEATBIT_E2E_API_IMAGE ?? "featbit/featbit-api-server:5.4.2";
const postgresPassword = process.env.FEATBIT_E2E_POSTGRES_PASSWORD ?? "please_change_me";
const postgresDatabase = process.env.FEATBIT_E2E_POSTGRES_DATABASE ?? "featbit";
const postgresUser = process.env.FEATBIT_E2E_POSTGRES_USER ?? "postgres";
const args = process.argv.slice(2);
const postgresLogs = [];
const apiLogs = [];

function spawnNode(commandArgs, options = {}) {
  return spawn(process.execPath, commandArgs, {
    cwd: process.cwd(),
    shell: false,
    windowsHide: true,
    ...options
  });
}

function runE2e(apiUrl) {
  const child = spawnNode(["./scripts/run-e2e.mjs", ...args], {
    env: {
      ...process.env,
      FEATBIT_E2E_API_URL: apiUrl
    },
    stdio: "inherit"
  });

  return new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      resolve(signal ? 1 : code ?? 1);
    });
  });
}

async function waitForApiReadiness(apiUrl, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/health/readiness`);
      if (response.ok) {
        return;
      }

      lastError = new Error(`readiness returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `API readiness endpoint did not become healthy after ${timeoutMs}ms` +
      (lastError instanceof Error ? `: ${lastError.message}` : "")
  );
}

async function stopResource(resource, name) {
  if (!resource) {
    return;
  }

  try {
    await resource.stop();
  } catch (error) {
    console.warn(`Failed to stop ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function printContainerLogs(container, name) {
  if (!container) {
    return;
  }

  try {
    const stream = await container.logs();
    console.error(`\n--- ${name} logs ---`);
    await Promise.race([
      new Promise((resolve) => {
      stream
        .on("data", (chunk) => {
          console.error(chunk.toString("utf8").trimEnd());
        })
        .on("err", (chunk) => {
          console.error(chunk.toString("utf8").trimEnd());
        })
        .on("end", resolve)
        .on("error", resolve);
      }),
      new Promise((resolve) =>
        setTimeout(() => {
          stream.destroy();
          resolve(undefined);
        }, 5000)
      )
    ]);
  } catch (error) {
    console.error(`Failed to read ${name} logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function collectLogs(target) {
  return (stream) => {
    stream
      .on("data", (chunk) => target.push(chunk.toString("utf8").trimEnd()))
      .on("err", (chunk) => target.push(chunk.toString("utf8").trimEnd()));
  };
}

function printCollectedLogs(logs, name) {
  if (logs.length === 0) {
    return;
  }

  console.error(`\n--- ${name} captured logs ---`);
  console.error(logs.join("\n"));
}

let network;
let postgres;
let api;
let failed = false;

try {
  network = await new Network().start();

  postgres = await new GenericContainer(postgresImage)
    .withNetwork(network)
    .withNetworkAliases("postgres")
    .withLogConsumer(collectLogs(postgresLogs))
    .withEnvironment({
      POSTGRES_DB: postgresDatabase,
      POSTGRES_PASSWORD: postgresPassword,
      POSTGRES_USER: postgresUser
    })
    .withExposedPorts(POSTGRES_PORT)
    .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(120000))
    .start();

  api = await new GenericContainer(apiImage)
    .withNetwork(network)
    .withLogConsumer(collectLogs(apiLogs))
    .withEnvironment({
      ASPNETCORE_ENVIRONMENT: "Production",
      ASPNETCORE_URLS: `http://*:${API_PORT}`,
      CacheProvider: "None",
      DbProvider: "Postgres",
      Jwt__Key: "featbit-e2e-jwt-key-must-be-longer-than-32-characters",
      MqProvider: "Postgres",
      Postgres__ConnectionString:
        `Host=postgres;Port=${POSTGRES_PORT};Username=${postgresUser};Password=${postgresPassword};Database=${postgresDatabase}`
    })
    .withExposedPorts(API_PORT)
    .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(120000))
    .start();

  const apiUrl = `http://${api.getHost()}:${api.getMappedPort(API_PORT)}`;
  await waitForApiReadiness(apiUrl);

  const exitCode = await runE2e(apiUrl);
  process.exitCode = exitCode;
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.stack : String(error));
  throw error;
} finally {
  if (failed) {
    printCollectedLogs(apiLogs, "api container");
    printCollectedLogs(postgresLogs, "postgres container");
    await printContainerLogs(api, "api container");
    await printContainerLogs(postgres, "postgres container");
  }

  await stopResource(api, "api container");
  await stopResource(postgres, "postgres container");
  await stopResource(network, "test network");
}
