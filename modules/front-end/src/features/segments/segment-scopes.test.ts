import { describe, expect, it } from "vitest"
import { environmentScopeRn } from "./segment-scopes"

describe("segment scopes", () => {
  it("builds the canonical environment scope including its organization", () => {
    expect(
      environmentScopeRn({
        organizationKey: "acme",
        projectKey: "payments",
        environmentKey: "production",
      })
    ).toBe("organization/acme:project/payments:env/production")
  })
})
