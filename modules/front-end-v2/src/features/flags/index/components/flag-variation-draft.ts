export const flagVariationTypes = [
  "boolean",
  "string",
  "number",
  "json",
] as const

export type FlagVariationType = (typeof flagVariationTypes)[number]

export type FlagVariationDraft = {
  id: string
  name: string
  value: string
}

export type FlagVariationSettingsDraft = {
  variationType: FlagVariationType
  variations: FlagVariationDraft[]
  enabledVariationId: string
  disabledVariationId: string
  isEnabled: boolean
}

const defaultVariations: Record<
  FlagVariationType,
  Array<Pick<FlagVariationDraft, "name" | "value">>
> = {
  boolean: [
    { name: "True", value: "true" },
    { name: "False", value: "false" },
  ],
  string: [
    { name: "Variation A", value: "variation-a" },
    { name: "Variation B", value: "variation-b" },
  ],
  number: [
    { name: "Variation 1", value: "1" },
    { name: "Variation 2", value: "2" },
  ],
  json: [
    { name: "Variation A", value: "{}" },
    { name: "Variation B", value: "{}" },
  ],
}

export function createDefaultFlagVariationSettings(
  variationType: FlagVariationType = "boolean"
): FlagVariationSettingsDraft {
  const variations = defaultVariations[variationType].map((variation) => ({
    id: crypto.randomUUID(),
    ...variation,
  }))

  return {
    variationType,
    variations,
    enabledVariationId: variations[0].id,
    disabledVariationId: variations[1].id,
    isEnabled: false,
  }
}

export function isFlagVariationSettingsCustomized(
  settings: FlagVariationSettingsDraft
) {
  const defaults = defaultVariations[settings.variationType]
  if (settings.variations.length !== defaults.length) return true

  const variationsChanged = settings.variations.some(
    (variation, index) =>
      variation.name !== defaults[index].name ||
      variation.value !== defaults[index].value
  )

  return (
    variationsChanged ||
    settings.enabledVariationId !== settings.variations[0]?.id ||
    settings.disabledVariationId !== settings.variations[1]?.id
  )
}

export type FlagVariationValueError = "required" | "boolean" | "number" | "json"

export function getFlagVariationValueError(
  variationType: FlagVariationType,
  value: string
): FlagVariationValueError | null {
  if (!value.trim()) return "required"
  if (variationType === "boolean") {
    return value === "true" || value === "false" ? null : "boolean"
  }
  if (variationType === "number") {
    return !Number.isNaN(Number(value)) &&
      !Number.isNaN(Number.parseFloat(value))
      ? null
      : "number"
  }
  if (variationType !== "json") return null

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === "object" ? null : "json"
  } catch {
    return "json"
  }
}

export function isFlagVariationValueValid(
  variationType: FlagVariationType,
  value: string
) {
  return getFlagVariationValueError(variationType, value) === null
}
