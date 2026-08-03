import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = 4200;
const url = `http://${host}:${port}/en/login`;
const viteBin = "./node_modules/vite/bin/vite.js";
const playwrightBin = "./node_modules/@playwright/test/cli.js";
const args = process.argv.slice(2);

function spawnNode(commandArgs, options = {}) {
  return spawn(process.execPath, commandArgs, {
    cwd: process.cwd(),
    shell: false,
    windowsHide: true,
    ...options
  });
}

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ""}`);
}

async function stopServer(server) {
  if (server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  server.kill("SIGINT");

  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);

  if (server.exitCode === null && server.signalCode === null) {
    if (process.platform === "win32" && server.pid) {
      await new Promise((resolve) => {
        const taskkill = spawn("taskkill.exe", ["/pid", String(server.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true
        });

        taskkill.on("exit", resolve);
        taskkill.on("error", resolve);
      });
      return;
    }

    server.kill("SIGKILL");
  }
}

const server = spawnNode([viteBin, "--host", host, "--port", String(port)], {
  stdio: ["ignore", "ignore", "inherit"]
});

try {
  await waitForServer();

  const testProcess = spawnNode([playwrightBin, "test", ...args], {
    env: {
      ...process.env,
      FEATBIT_E2E_EXTERNAL_SERVER: "1"
    },
    stdio: "inherit"
  });

  const exitCode = await new Promise((resolve) => {
    testProcess.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });

  process.exitCode = exitCode;
} finally {
  await stopServer(server);
}
