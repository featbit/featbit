import baseConfig from "./playwright.config"

const baseURL = process.env.FEATBIT_E2E_BASE_URL
const apiUrl = process.env.FEATBIT_E2E_API_URL

if (!baseURL || !apiUrl) {
  throw new Error("Start the container stack with npm run test:e2e:containers")
}

export default {
  ...baseConfig,
  webServer: undefined,
  use: {
    ...baseConfig.use,
    baseURL,
  },
  metadata: {
    containerApiUrl: apiUrl,
  },
}
