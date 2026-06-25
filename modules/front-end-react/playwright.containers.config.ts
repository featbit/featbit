import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  globalSetup: "./src/test/e2e/global-setup.containers.ts"
};
