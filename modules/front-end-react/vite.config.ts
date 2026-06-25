import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type ViteDevServer } from "vite";

function runtimeEnvPlugin() {
  return {
    name: "featbit-runtime-env",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/assets/env.js", (_request: IncomingMessage, response: ServerResponse, next: () => void) => {
        const apiUrl = process.env.FEATBIT_E2E_API_URL;

        if (!apiUrl) {
          next();
          return;
        }

        response.setHeader("Content-Type", "application/javascript");
        response.end(`window.env = window.env || {
  API_URL: ${JSON.stringify(apiUrl)},
  DEMO_URL: "",
  EVALUATION_URL: "",
  DISPLAY_API_URL: ${JSON.stringify(apiUrl)},
  DISPLAY_EVALUATION_URL: "",
  HOSTING_MODE: "test",
  VERSION: "e2e"
};
`);
      });
    }
  };
}

export default defineConfig({
  server: {
    port: 4200,
  },
  plugins: [runtimeEnvPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    sourcemap: true
  }
});
