import { describe, expect, it } from "vitest"
import { prometheusConnectionWrite } from "./release-health-api"
import { emptySourceConnectionConfiguration } from "./components/source-connection-provider-types"

describe("Prometheus connection write boundary", () => {
  it("sends only the selected provider branch and never its preview credentials", () => {
    const value = prometheusConnectionWrite("Test", {
      ...emptySourceConnectionConfiguration,
      endpoint: "https://metrics.example.com",
      authentication: "bearer_token",
      prometheusBearerToken: "test-token",
      datadogApiKey: "preview-only",
    })
    expect(value.providerSchemaVersion).toBe(1)
    expect(value.secretUpdate).toEqual({
      operation: "replace",
      token: "test-token",
    })
    expect(JSON.stringify(value)).not.toContain("preview-only")
    expect(value.authentication).not.toHaveProperty("username")
  })
  it("keeps a saved Basic secret without submitting a mask or existing value", () => {
    const value = prometheusConnectionWrite(
      "Test",
      {
        ...emptySourceConnectionConfiguration,
        authentication: "basic",
        prometheusBasicUsername: "reader",
      },
      3
    )
    expect(value.secretUpdate).toEqual({ operation: "keep" })
    expect(value.expectedVersion).toBe(3)
    expect(value.authentication).toEqual({ type: "basic", username: "reader" })
  })
  it("removes credentials for no authentication, ignoring stale draft fields", () => {
    const value = prometheusConnectionWrite("Test", {
      ...emptySourceConnectionConfiguration,
      authentication: "none",
      prometheusBearerToken: "stale-token",
      prometheusBasicPassword: "stale-password",
    })
    expect(value.secretUpdate).toEqual({ operation: "remove" })
    expect(JSON.stringify(value)).not.toContain("stale-")
  })
})
