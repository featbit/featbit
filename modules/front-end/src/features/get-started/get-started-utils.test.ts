import { describe, expect, it } from "vitest"
import { SDK_DEFINITIONS } from "./sdk-definitions"
import {
  buildDemoUrl,
  createBooleanFlagPayload,
  formatDuration,
  hasEvaluationEvents,
  maskSecret,
  toFlagKey,
} from "./get-started-utils"

describe("get started utilities", () => {
  it("builds a stable feature flag key from a display name", () => {
    expect(toFlagKey("  Checkout redesign!  ")).toBe("checkout-redesign")
    expect(toFlagKey("Release__Mode")).toBe("release-mode")
  })

  it("creates the fixed Boolean preset used by onboarding", () => {
    const ids = ["variation-true", "variation-false"]
    const payload = createBooleanFlagPayload(
      {
        name: "Checkout redesign",
        key: "checkout-redesign",
        description: "Controls the new checkout.",
      },
      () => ids.shift()!
    )

    expect(payload).toMatchObject({
      variationType: "boolean",
      isEnabled: false,
      enabledVariationId: "variation-true",
      disabledVariationId: "variation-false",
      variations: [
        { id: "variation-true", name: "True", value: "true" },
        { id: "variation-false", name: "False", value: "false" },
      ],
    })
  })

  it("masks secrets while retaining the last four characters", () => {
    expect(maskSecret("server-secret-7K2M")).toBe("********7K2M")
    expect(maskSecret("")).toBe("Not configured")
  })

  it("detects any positive evaluation count", () => {
    expect(
      hasEvaluationEvents([
        { time: "now", variations: [{ variation: "true", count: 0 }] },
        { time: "later", variations: [{ variation: "false", count: 1 }] },
      ])
    ).toBe(true)
    expect(
      hasEvaluationEvents([
        { time: "now", variations: [{ variation: "true", count: 0 }] },
      ])
    ).toBe(false)
  })

  it("formats verification time consistently", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(68)).toBe("1:08")
  })

  it("builds the interactive demo URL only with complete configuration", () => {
    expect(
      buildDemoUrl(
        "https://demo.featbit.co",
        "https://evaluation.featbit.co",
        "client-secret"
      )
    ).toBe(
      "https://demo.featbit.co/?envKey=client-secret&evaluationUrl=https%3A%2F%2Fevaluation.featbit.co"
    )
    expect(buildDemoUrl("", "https://evaluation.featbit.co", "secret")).toBe("")
    expect(
      buildDemoUrl("not a url", "https://evaluation.featbit.co", "secret")
    ).toBe("")
  })

  it("keeps all six SDKs functional and data-driven", () => {
    expect(SDK_DEFINITIONS.map((sdk) => sdk.label)).toEqual([
      "JavaScript",
      "Node.js",
      "Python",
      "Java",
      ".NET",
      "Go",
    ])

    for (const sdk of SDK_DEFINITIONS) {
      const snippet = sdk.buildSnippet({
        flagKey: "checkout-redesign",
        secret: "server-secret",
        eventUrl: "https://events.example.com",
        streamingUrl: "wss://stream.example.com",
      })
      expect(sdk.install).not.toBe("")
      expect(sdk.documentationUrl).toMatch(/^https:\/\/github\.com\/featbit\//)
      expect(snippet).toContain("checkout-redesign")
      expect(snippet).toContain("server-secret")
    }
  })
})
