import { describe, expect, it } from "vitest"
import type { FeatureFlag } from "../../flags-types"
import {
  flagSettingsOf,
  flagSettingsReviewChanges,
  stableFlagSettings,
} from "./settings-utils"

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout redesign",
  key: "checkout-redesign",
  description: "Old description",
  tags: ["checkout"],
  isEnabled: true,
  createdAt: "2026-07-27T08:00:00.000Z",
  updatedAt: "2026-07-27T08:00:00.000Z",
  variationType: "boolean",
}

describe("feature flag settings utilities", () => {
  it("normalizes tag order for dirty-state comparison", () => {
    const settings = {
      ...flagSettingsOf(flag),
      tags: ["checkout", "growth"],
    }
    expect(
      stableFlagSettings({
        ...settings,
        tags: [...settings.tags].reverse(),
      })
    ).toBe(stableFlagSettings(settings))
  })

  it("preserves name whitespace in comparisons", () => {
    const previous = {
      ...flagSettingsOf(flag),
      name: `${flag.name} `,
    }

    expect(stableFlagSettings(previous)).not.toBe(
      stableFlagSettings({ ...previous, name: flag.name })
    )
    expect(flagSettingsReviewChanges(previous, previous)).toEqual([])
  })

  it("builds semantic changes for fields and tags", () => {
    const previous = flagSettingsOf(flag)
    expect(
      flagSettingsReviewChanges(previous, {
        name: "Checkout rollout",
        description: "New description",
        tags: ["growth"],
      })
    ).toEqual([
      expect.objectContaining({
        kind: "field",
        label: "name",
        previous: "Checkout redesign",
        current: "Checkout rollout",
      }),
      expect.objectContaining({
        kind: "field",
        label: "description",
        previous: "Old description",
        current: "New description",
      }),
      expect.objectContaining({
        kind: "tags",
        label: "tags",
        valueGroups: [
          { action: "added", values: ["growth"] },
          { action: "removed", values: ["checkout"] },
        ],
      }),
    ])
  })
})
