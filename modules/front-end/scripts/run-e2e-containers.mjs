import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GenericContainer, Network, Wait } from "testcontainers";

const POSTGRES_PORT = 5432;
const API_PORT = 5000;
const FRONTEND_PORT = 80;
const frontendDirectory = fileURLToPath(new URL("../", import.meta.url));
// The API image builds from modules/, not modules/back-end/: its Dockerfile copies both
// back-end/ and shared/, and the shared observability projects sit outside back-end/.
const modulesDirectory = fileURLToPath(new URL("../../", import.meta.url));
const runId = randomUUID();
const logDirectory = join(frontendDirectory, "logs", "e2e-containers", runId);
const postgresImage = process.env.FEATBIT_E2E_POSTGRES_IMAGE ?? "postgres:16-alpine";
const apiImage = `featbit-api-e2e:${runId}`;
const frontendImage = `featbit-frontend-e2e:${runId}`;
const postgresPassword = process.env.FEATBIT_E2E_POSTGRES_PASSWORD ?? "please_change_me";
const postgresDatabase = process.env.FEATBIT_E2E_POSTGRES_DATABASE ?? "featbit";
const postgresUser = process.env.FEATBIT_E2E_POSTGRES_USER ?? "postgres";
const args = process.argv.slice(2);
const postgresLogs = [];
const apiLogs = [];
const frontendLogs = [];
const builtImages = [];
let activeLogFile;
let logsReady = false;

async function loadPostgresInitSql() {
  const directory = new URL("../../../infra/postgresql/docker-entrypoint-initdb.d/", import.meta.url);
  const files = (await readdir(directory))
    .filter((name) => /^v\d+\.\d+\.\d+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  if (files.length === 0) {
    throw new Error("No PostgreSQL initialization scripts found");
  }
  const scripts = await Promise.all(files.map((name) => readFile(new URL(name, directory), "utf8")));
  // Match the backend integration fixture for the source being built.
  scripts.push(
    await readFile(
      new URL("../../back-end/tests/Infrastructure.IntegrationTests/Fixtures/vNext.sql", import.meta.url),
      "utf8"
    )
  );
  // The image entrypoint already creates POSTGRES_DB and runs SQL in that database.
  return scripts
    .join("\n")
    .replace(/^\s*create database featbit;\s*$/gim, "")
    .replace(/^\s*\\connect\s+featbit\s*;?\s*$/gim, "");
}

function runProcess(command, commandArgs, options = {}) {
  const child = spawn(command, commandArgs, {
    cwd: frontendDirectory,
    shell: false,
    windowsHide: true,
    stdio: "inherit",
    ...options
  });

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

async function runDocker(commandArgs, options = {}) {
  const exitCode = await runProcess("docker", commandArgs, options);
  if (exitCode !== 0) {
    throw new Error(`docker ${commandArgs[0]} failed with exit code ${exitCode}`);
  }
}

async function buildImage(name, image, directory, dockerfile) {
  console.log(`[e2e] Building ${name} image...`);
  activeLogFile = join(logDirectory, `${name}-build.log`);
  const log = await open(activeLogFile, "w");
  try {
    await runDocker(
      [
        "build",
        "--load",
        "--progress=plain",
        "--file",
        dockerfile,
        "--tag",
        image,
        "--build-arg",
        "VERSION=e2e",
        directory
      ],
      { stdio: ["ignore", log.fd, log.fd] }
    );
    builtImages.push(image);
  } finally {
    await log.close();
  }
}

function runE2e(apiUrl, frontendUrl) {
  return runProcess(process.execPath, ["./node_modules/@playwright/test/cli.js", "test", ...args], {
    env: {
      ...process.env,
      FEATBIT_E2E_API_URL: apiUrl,
      FEATBIT_E2E_BASE_URL: frontendUrl
    }
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

async function printLogTail(file) {
  try {
    const content = await readFile(file, "utf8");
    if (content.trim()) {
      console.error(`[e2e] Recent output from ${file}:`);
      console.error(content.trimEnd().split(/\r?\n/).slice(-40).join("\n").slice(-8000));
    }
  } catch (error) {
    console.warn(`Failed to read log ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function collectLogs(target) {
  return (stream) => {
    stream
      .on("data", (chunk) => target.push(chunk.toString("utf8").trimEnd()))
      .on("err", (chunk) => target.push(chunk.toString("utf8").trimEnd()));
  };
}

async function saveLog(name, content) {
  try {
    await writeFile(join(logDirectory, name), content, "utf8");
  } catch (error) {
    console.warn(`Failed to save ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let network;
let postgres;
let api;
let frontend;
let infrastructureError;

try {
  await mkdir(logDirectory, { recursive: true });
  logsReady = true;
  const postgresInitSql = await loadPostgresInitSql();
  await buildImage(
    "api",
    apiImage,
    modulesDirectory,
    fileURLToPath(new URL("../../back-end/deploy/Dockerfile", import.meta.url))
  );
  await buildImage(
    "frontend",
    frontendImage,
    frontendDirectory,
    fileURLToPath(new URL("../Dockerfile", import.meta.url))
  );
  activeLogFile = undefined;
  network = await new Network().start();

  console.log("[e2e] Starting PostgreSQL...");
  activeLogFile = join(logDirectory, "postgres.log");
  postgres = await new GenericContainer(postgresImage)
    .withNetwork(network)
    .withNetworkAliases("postgres")
    .withLogConsumer(collectLogs(postgresLogs))
    .withCopyContentToContainer([
      {
        content: postgresInitSql,
        target: "/docker-entrypoint-initdb.d/001-featbit.sql"
      }
    ])
    .withEnvironment({
      POSTGRES_DB: postgresDatabase,
      POSTGRES_PASSWORD: postgresPassword,
      POSTGRES_USER: postgresUser
    })
    .withExposedPorts(POSTGRES_PORT)
    .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(120000))
    .start();

  console.log("[e2e] Starting API...");
  activeLogFile = join(logDirectory, "api.log");
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
      Postgres__ConnectionString: `Host=postgres;Port=${POSTGRES_PORT};Username=${postgresUser};Password=${postgresPassword};Database=${postgresDatabase}`
    })
    .withExposedPorts(API_PORT)
    .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(120000))
    .start();

  const apiUrl = `http://${api.getHost()}:${api.getMappedPort(API_PORT)}`;
  await waitForApiReadiness(apiUrl);

  console.log("[e2e] Starting frontend...");
  activeLogFile = join(logDirectory, "frontend.log");
  frontend = await new GenericContainer(frontendImage)
    .withNetwork(network)
    .withLogConsumer(collectLogs(frontendLogs))
    .withEnvironment({
      API_URL: apiUrl,
      DISPLAY_API_URL: apiUrl,
      HOSTING_MODE: "self-hosted"
    })
    .withExposedPorts(FRONTEND_PORT)
    .withWaitStrategy(Wait.forHttp("/health", FRONTEND_PORT).withStartupTimeout(120000))
    .start();
  const frontendUrl = `http://${frontend.getHost()}:${frontend.getMappedPort(FRONTEND_PORT)}`;

  activeLogFile = undefined;
  process.exitCode = await runE2e(apiUrl, frontendUrl);
} catch (error) {
  infrastructureError = error;
  process.exitCode = 1;
  console.error(`[e2e] ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await stopResource(frontend, "frontend container");
  await stopResource(api, "api container");
  await stopResource(postgres, "postgres container");
  await stopResource(network, "test network");
  for (const image of builtImages) {
    try {
      await runDocker(["image", "rm", image], { stdio: "ignore" });
    } catch (error) {
      console.warn(`Failed to remove test image ${image}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (logsReady) {
    await saveLog("postgres.log", postgresLogs.join("\n"));
    await saveLog("api.log", apiLogs.join("\n"));
    await saveLog("frontend.log", frontendLogs.join("\n"));
    if (infrastructureError) {
      await saveLog(
        "runner-error.log",
        infrastructureError instanceof Error ? infrastructureError.stack : String(infrastructureError)
      );
      if (activeLogFile) {
        await printLogTail(activeLogFile);
      }
    }
    console.log(`[e2e] Diagnostic logs: ${logDirectory}`);
  }
}
