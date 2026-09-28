import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import type { FeatureFlag } from "../../flags-types"

export type FlagSettingsValues = {
  name: string
  description: string
  tags: string[]
  insightsEnabled: boolean
}

export type FlagSettingsField = keyof FlagSettingsValues

export type FlagSettingsReviewChange = ChangeReviewItem & {
  kind: "field" | "tags"
}

export function flagSettingsOf(flag: FeatureFlag): FlagSettingsValues {
  return {
    name: flag.name,
    description: flag.description ?? "",
    tags: flag.tags ?? [],
    insightsEnabled: flag.insightsEnabled !== false,
  }
}

export function stableFlagSettings(values: FlagSettingsValues) {
  return JSON.stringify({
    name: values.name,
    description: values.description,
    tags: [...values.tags].sort(),
    insightsEnabled: values.insightsEnabled,
  })
}

export function flagSettingsReviewChanges(
  previous: FlagSettingsValues,
  current: FlagSettingsValues,
  insightsLabel: (enabled: boolean) => string = String
): FlagSettingsReviewChange[] {
  const changes: FlagSettingsReviewChange[] = []
  if (previous.name !== current.name) {
    changes.push({
      kind: "field",
      label: "name",
      action: "updated",
      previous: previous.name,
      current: current.name,
    })
  }
  if (previous.description !== current.description) {
    changes.push({
      kind: "field",
      label: "description",
      action: "updated",
      previous: previous.description,
      current: current.description,
    })
  }
  if (
    JSON.stringify([...previous.tags].sort()) !==
    JSON.stringify([...current.tags].sort())
  ) {
    const added = current.tags.filter((tag) => !previous.tags.includes(tag))
    const removed = previous.tags.filter((tag) => !current.tags.includes(tag))
    changes.push({
      kind: "tags",
      label: "tags",
      valueGroups: [
        ...(added.length ? [{ action: "added" as const, values: added }] : []),
        ...(removed.length
          ? [{ action: "removed" as const, values: removed }]
          : []),
      ],
    })
  }
  if (previous.insightsEnabled !== current.insightsEnabled) {
    changes.push({
      kind: "field",
      label: "insightsEnabled",
      action: "updated",
      previous: insightsLabel(previous.insightsEnabled),
      current: insightsLabel(current.insightsEnabled),
    })
  }
  return changes
}
