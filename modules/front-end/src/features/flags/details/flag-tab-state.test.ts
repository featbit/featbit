import { describe, expect, it } from "vitest"
import type { FeatureFlag, FlagTargeting } from "../flags-types"
import { withFlagTargeting, withFlagVariations } from "./flag-tab-state"

const saved: FeatureFlag = {
  id: "flag-1",
  key: "checkout",
  name: "Checkout",
  tags: [],
  isEnabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  variationType: "boolean",
  revision: "revision-1",
  variations: [
    { id: "on", name: "On", value: "true" },
    { id: "off", name: "Off", value: "false" },
  ],
  disabledVariationId: "off",
  targetUsers: [],
  rules: [],
  fallthrough: {
    variations: [{ id: "on", rollout: [0, 1] }],
    dispatchKey: "keyId",
  },
  exptIncludeAllTargets: false,
}

const targetingDraft: FlagTargeting = {
  disabledVariationId: "on",
  targetUsers: [{ variationId: "on", keyIds: ["user-1"] }],
  rules: [],
  fallthrough: {
    variations: [{ id: "off", rollout: [0, 1] }],
    dispatchKey: "keyId",
  },
  exptIncludeAllTargets: false,
}

describe("flag tab state", () => {
  it("keeps a targeting draft out of the variations data", () => {
    const targetingFlag = withFlagTargeting(saved, targetingDraft)

    expect(targetingFlag.disabledVariationId).toBe("on")
    expect(targetingFlag.variations).toEqual(saved.variations)
    expect(saved.disabledVariationId).toBe("off")
  })

  it("keeps a variations draft out of the targeting data", () => {
    const variations = [
      { id: "on", name: "Enabled", value: "true" },
      { id: "off", name: "Disabled", value: "false" },
    ]
    const variationsFlag = withFlagVariations(saved, variations)

    expect(variationsFlag.variations).toEqual(variations)
    expect(variationsFlag.disabledVariationId).toBe("off")
    expect(variationsFlag.targetUsers).toEqual([])
  })

  it("rebases one tab's draft on the latest saved data from another tab", () => {
    const savedAfterVariations = withFlagVariations(
      saved,
      [{ id: "on", name: "Enabled", value: "true" }],
      "revision-2"
    )
    const targetingFlag = withFlagTargeting(
      savedAfterVariations,
      targetingDraft
    )

    expect(targetingFlag.variations).toEqual(savedAfterVariations.variations)
    expect(targetingFlag.disabledVariationId).toBe("on")
    expect(targetingFlag.revision).toBe("revision-2")
  })
})
