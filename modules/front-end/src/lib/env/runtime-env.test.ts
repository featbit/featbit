import { afterEach, describe, expect, it } from "vitest"

import { getRuntimeEnv } from "./runtime-env"

describe("getRuntimeEnv", () => {
  afterEach(() => {
    window.env = undefined
  })

  it("returns application defaults when runtime configuration is missing", () => {
    window.env = undefined

    expect(getRuntimeEnv()).toEqual({
      apiUrl: "http://localhost:5000",
      demoUrl: "https://featbit-samples.vercel.app",
      evaluationUrl: "http://localhost:5100",
      baseHref: "",
      displayApiUrl: "",
      displayEvaluationUrl: "",
      hostingMode: "self-hosted",
      version: "dev",
    })
  })

  it("uses application defaults for empty runtime values", () => {
    window.env = {
      API_URL: "",
      DEMO_URL: "",
      EVALUATION_URL: "",
      HOSTING_MODE: "",
      VERSION: "",
    }

    expect(getRuntimeEnv()).toMatchObject({
      apiUrl: "http://localhost:5000",
      demoUrl: "https://featbit-samples.vercel.app",
      evaluationUrl: "http://localhost:5100",
      hostingMode: "self-hosted",
      version: "dev",
    })
  })

  it("prefers supplied runtime values", () => {
    window.env = {
      API_URL: "https://api.example.com",
      EVALUATION_URL: "https://evaluation.example.com",
      BASE_HREF: "/featbit/",
      HOSTING_MODE: "saas",
      VERSION: "6.0.0",
    }

    expect(getRuntimeEnv()).toMatchObject({
      apiUrl: "https://api.example.com",
      evaluationUrl: "https://evaluation.example.com",
      baseHref: "/featbit",
      hostingMode: "saas",
      version: "6.0.0",
    })
  })
})
