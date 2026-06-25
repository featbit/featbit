import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "src/test/e2e/**"],
    setupFiles: ["./src/test/setup.ts"]
  }
});
