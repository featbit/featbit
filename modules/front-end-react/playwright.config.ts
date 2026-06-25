import { defineConfig, devices } from "@playwright/test";

const useExternalServer = process.env.FEATBIT_E2E_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4200",
    trace: "on-first-retry"
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4200",
        url: "http://127.0.0.1:4200",
        gracefulShutdown: { signal: "SIGINT", timeout: 500 },
        reuseExistingServer: !process.env.CI
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
