import type {
  FeatureFlag,
  FlagComparisonDetail,
  FlagComparisonValue,
  FlagSettingCopyOptions,
} from "../../../flags-types"
import { documentationRows } from "../../../custom-fields/custom-fields-model"
import { flagSettingsOf } from "../settings-utils"
import {
  readCustomFieldsProject,
  documentationRecordKey,
} from "../../../custom-fields/custom-fields-storage"
import {
  currentPreviewFlag,
  previewFlagKey,
  previewProjectId,
} from "./preview-fixtures"

function value(flag: FeatureFlag): FlagComparisonValue {
  return {
    id: flag.id,
    name: flag.name,
    key: flag.key,
    isEnabled: flag.isEnabled,
    variations: flag.variations ?? [],
    targetUsers: flag.targetUsers ?? [],
    rules: flag.rules ?? [],
    fallthrough: flag.fallthrough ?? null,
    disabledVariationId: flag.disabledVariationId ?? "",
  }
}

export function previewComparison(
  sourceId: string,
  targetId: string
): FlagComparisonDetail {
  const source = value(currentPreviewFlag(sourceId))
  const target = value(currentPreviewFlag(targetId))
  const differs = (a: unknown, b: unknown) =>
    JSON.stringify(a) !== JSON.stringify(b)
  return {
    source,
    target,
    diff: {
      onOffState: {
        source: source.isEnabled,
        target: target.isEnabled,
        isDifferent: source.isEnabled !== target.isEnabled,
      },
      individualTargeting: [
        { isDifferent: differs(source.targetUsers, target.targetUsers) },
      ],
      targetingRule: [
        ...new Set([...source.rules, ...target.rules].map((rule) => rule.id)),
      ].map((id) => {
        const a = source.rules.find((rule) => rule.id === id) ?? null
        const b = target.rules.find((rule) => rule.id === id) ?? null
        return {
          source: a,
          target: b,
          isDifferent: differs(a, b),
          canAppend: !b,
        }
      }),
      defaultRule: {
        isDifferent: differs(source.fallthrough, target.fallthrough),
      },
      offVariation: {
        isDifferent: source.disabledVariationId !== target.disabledVariationId,
      },
    },
    relatedSegments: [],
    isRulesCopyable: true,
  }
}

export function previewCompareOverview(
  sourceId: string,
  targetIds: string[],
  filter: { name?: string; tags?: string[] }
) {
  const source = currentPreviewFlag(sourceId)
  if (
    !`${source.name} ${source.key}`
      .toLowerCase()
      .includes((filter.name ?? "").toLowerCase()) ||
    (filter.tags ?? []).some((tag) => !source.tags.includes(tag))
  )
    return { items: [], totalCount: 0 }
  const state = readCustomFieldsProject(previewProjectId)
  const sourceRecord = state.records[
    documentationRecordKey(sourceId, previewFlagKey)
  ] ?? { general: flagSettingsOf(source), customFields: {} }
  const diffs = targetIds.map((targetId) => {
    const detail = previewComparison(sourceId, targetId)
    const targetRecord = state.records[
      documentationRecordKey(targetId, previewFlagKey)
    ] ?? {
      general: flagSettingsOf(currentPreviewFlag(targetId)),
      customFields: {},
    }
    const fields = documentationRows(
      sourceRecord,
      state.fields,
      targetRecord,
      state.fields
    )
    return {
      targetEnvId: targetId,
      onOffState: detail.diff.onOffState.isDifferent,
      individualTargeting: detail.diff.individualTargeting.some(
        (item) => item.isDifferent
      ),
      targetingRule: detail.diff.targetingRule.some((item) => item.isDifferent),
      defaultRule: detail.diff.defaultRule.isDifferent,
      offVariation: detail.diff.offVariation.isDifferent,
      description: fields.some(
        (field) => field.key === "description" && field.different
      ),
      customFields: fields
        .filter((field) => field.sourceField && field.different)
        .map((field) => ({ id: field.sourceField!.id, name: field.name })),
    }
  })
  return {
    items: [
      {
        id: source.id,
        name: source.name,
        key: source.key,
        description: source.description,
        tags: source.tags,
        diffs,
      },
    ],
    totalCount: 1,
  }
}

export function copyPreviewRuntimeSettings(
  sourceId: string,
  targetId: string,
  options: FlagSettingCopyOptions
) {
  const source = currentPreviewFlag(sourceId)
  const target = currentPreviewFlag(targetId)
  const append = <T>(before: T[], after: T[]) => [
    ...before,
    ...after.filter(
      (item) =>
        !before.some((entry) => JSON.stringify(entry) === JSON.stringify(item))
    ),
  ]
  const next = {
    isEnabled: options.onOffState ? source.isEnabled : target.isEnabled,
    targetUsers: options.individualTargeting.copy
      ? options.individualTargeting.mode === "append"
        ? append(target.targetUsers ?? [], source.targetUsers ?? [])
        : source.targetUsers
      : target.targetUsers,
    rules: options.targetingRule.copy
      ? options.targetingRule.mode === "append"
        ? append(target.rules ?? [], source.rules ?? [])
        : source.rules
      : target.rules,
    fallthrough: options.defaultRule ? source.fallthrough : target.fallthrough,
    disabledVariationId: options.offVariation
      ? source.disabledVariationId
      : target.disabledVariationId,
  }
  sessionStorage.setItem(
    `featbit:flag-preview-runtime:${targetId}`,
    JSON.stringify(next)
  )
}
