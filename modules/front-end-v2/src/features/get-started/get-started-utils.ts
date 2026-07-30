import type { FeatureFlagInsight } from "@/features/flags/details/insights/insights-types"
import type { FlagCreationPayload } from "@/features/flags/flags-types"

export function toFlagKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
}

export function createBooleanFlagPayload(
  values: { name: string; key: string; description: string },
  idFactory: () => string = makeId
): FlagCreationPayload {
  const enabledVariationId = idFactory()
  const disabledVariationId = idFactory()

  return {
    name: values.name.trim(),
    key: values.key.trim(),
    description: values.description.trim(),
    tags: [],
    isEnabled: false,
    variationType: "boolean",
    enabledVariationId,
    disabledVariationId,
    variations: [
      { id: enabledVariationId, name: "True", value: "true" },
      { id: disabledVariationId, name: "False", value: "false" },
    ],
  }
}

export function maskSecret(value: string) {
  if (!value) return "Not configured"
  const visible = value.slice(-4)
  return `${"*".repeat(Math.max(8, value.length - visible.length))}${visible}`
}

export function hasEvaluationEvents(insights: FeatureFlagInsight[]) {
  return insights.some((insight) =>
    insight.variations.some((variation) => variation.count > 0)
  )
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = String(safeSeconds % 60).padStart(2, "0")
  return `${minutes}:${seconds}`
}

export function buildDemoUrl(
  demoUrl: string,
  evaluationUrl: string,
  clientSecret: string
) {
  if (!demoUrl.trim() || !evaluationUrl.trim() || !clientSecret.trim()) {
    return ""
  }

  try {
    const url = new URL(demoUrl)
    url.searchParams.set("envKey", clientSecret)
    url.searchParams.set("evaluationUrl", evaluationUrl)
    return url.toString()
  } catch {
    return ""
  }
}
