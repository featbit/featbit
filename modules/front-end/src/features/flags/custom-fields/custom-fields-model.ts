import { z } from "zod"
import type {
  FlagSettingsValues,
  FlagSettingsReviewChange,
} from "../details/settings/settings-utils"

export const controlTypes = [
  "datetime",
  "number",
  "checkbox",
  "markdown",
  "list",
] as const
export const controlSchema = z
  .object({
    id: z.string().min(1),
    key: z.string().min(1),
    label: z.string().trim().min(1),
    type: z.enum(controlTypes),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine((control, context) => {
    if (control.type !== "list") return
    const options = control.options ?? []
    if (
      !options.length ||
      new Set(options.map((option) => option.toLowerCase())).size !==
        options.length
    )
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "invalidListOptions",
      })
  })
export const customFieldSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().trim().min(1),
  required: z.boolean(),
  controls: z.array(controlSchema).min(1),
})
export type CustomField = z.infer<typeof customFieldSchema>
export type CustomControl = z.infer<typeof controlSchema>
export type ControlValue = string | number | boolean | string[] | null
export const customValuesSchema = z.record(
  z.string(),
  z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.null(),
    ])
  )
)
export type CustomFieldValues = z.infer<typeof customValuesSchema>
export type FlagSettingsFormValues = FlagSettingsValues & {
  customFields: CustomFieldValues
}
export type DocumentationRecord = {
  general: FlagSettingsValues
  customFields: CustomFieldValues
}
export type DocumentationSettingKey = "description" | `custom:${string}`

export function newControl(
  type: CustomControl["type"],
  label: string
): CustomControl {
  const id = crypto.randomUUID()
  return {
    id,
    key: id,
    type,
    label,
    ...(type === "list" ? { options: [] } : {}),
  }
}

export function normalizeCustomValues(
  fields: CustomField[],
  values: CustomFieldValues
): CustomFieldValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.id,
      Object.fromEntries(
        field.controls.map((control) => {
          const value = values[field.id]?.[control.id]
          if (control.type === "list" && Array.isArray(value))
            return [control.id, [...value].sort()]
          return [
            control.id,
            value ??
              (control.type === "list"
                ? []
                : control.type === "checkbox"
                  ? false
                  : control.type === "number"
                    ? null
                    : ""),
          ]
        })
      ),
    ])
  )
}

export type FieldIssue = {
  fieldId: string
  controlId: string
  code: "requiredValue" | "invalidValue"
}
export function validateCustomValues(
  fields: CustomField[],
  values: CustomFieldValues
): FieldIssue[] {
  return fields.flatMap((field) =>
    field.controls.flatMap((control): FieldIssue[] => {
      const value =
        values[field.id]?.[control.id] ??
        (control.type === "checkbox" ? false : null)
      const empty =
        value === null ||
        (typeof value === "string" && !value.trim()) ||
        (control.type === "list" && Array.isArray(value) && !value.length)
      if (empty)
        return field.required
          ? [
              {
                fieldId: field.id,
                controlId: control.id,
                code: "requiredValue",
              },
            ]
          : []
      const valid =
        control.type === "list"
          ? Array.isArray(value) &&
            new Set(value).size === value.length &&
            value.every((option) => control.options?.includes(option))
          : control.type === "number"
            ? typeof value === "number" && Number.isFinite(value)
            : control.type === "checkbox"
              ? typeof value === "boolean"
              : control.type === "datetime"
                ? typeof value === "string" &&
                  Number.isFinite(Date.parse(value))
                : typeof value === "string"
      return valid
        ? []
        : [{ fieldId: field.id, controlId: control.id, code: "invalidValue" }]
    })
  )
}

export function controlText(
  control: CustomControl,
  value: ControlValue | undefined,
  locale = "en"
): string {
  if (control.type === "checkbox") return String(value ?? false)
  if (control.type === "list")
    return Array.isArray(value) ? value.join(", ") : ""
  if (value === null || value === undefined || value === "") return ""
  if (
    control.type === "datetime" &&
    typeof value === "string" &&
    Number.isFinite(Date.parse(value))
  ) {
    return new Date(value).toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }
  return String(value)
}

export function fieldText(
  field: CustomField,
  values: CustomFieldValues
): string {
  return field.controls
    .map(
      (control) =>
        `${control.label}: ${controlText(control, values[field.id]?.[control.id])}`
    )
    .join("\n")
}

export function customFieldReviewChanges(
  fields: CustomField[],
  previous: CustomFieldValues,
  current: CustomFieldValues
): FlagSettingsReviewChange[] {
  const before = normalizeCustomValues(fields, previous)
  const after = normalizeCustomValues(fields, current)
  return fields
    .filter(
      (field) =>
        JSON.stringify(before[field.id]) !== JSON.stringify(after[field.id])
    )
    .map((field) => ({
      kind: "field",
      label: `custom:${field.id}`,
      literalLabel: true,
      previous: fieldText(field, before),
      current: fieldText(field, after),
      action: "updated",
    }))
}

export function matchingField(
  source: CustomField,
  targetFields: CustomField[]
): CustomField | undefined {
  return targetFields.find(
    (target) =>
      target.key === source.key &&
      target.controls.length === source.controls.length &&
      source.controls.every((control) =>
        target.controls.some(
          (other) => other.key === control.key && other.type === control.type
        )
      )
  )
}

export function mappedFieldValues(
  source: CustomField,
  target: CustomField,
  values: CustomFieldValues
) {
  const normalized = normalizeCustomValues([source], values)
  return Object.fromEntries(
    target.controls.map((control) => [
      control.id,
      normalized[source.id][
        source.controls.find((other) => other.key === control.key)!.id
      ],
    ])
  )
}

export function documentationRows(
  source: DocumentationRecord,
  sourceFields: CustomField[],
  target: DocumentationRecord,
  targetFields: CustomField[]
) {
  return [
    {
      key: "description" as DocumentationSettingKey,
      name: "Description",
      different: source.general.description !== target.general.description,
      sourceField: undefined as CustomField | undefined,
      targetField: undefined as CustomField | undefined,
    },
    ...sourceFields.map((field) => {
      const targetField = matchingField(field, targetFields)
      const different =
        !targetField ||
        JSON.stringify(
          mappedFieldValues(field, targetField, source.customFields)
        ) !==
          JSON.stringify(
            normalizeCustomValues([targetField], target.customFields)[
              targetField.id
            ]
          )
      return {
        key: `custom:${field.id}` as DocumentationSettingKey,
        name: field.name,
        different,
        sourceField: field,
        targetField,
      }
    }),
  ]
}

export function copyDocumentation(
  source: DocumentationRecord,
  sourceFields: CustomField[],
  target: DocumentationRecord,
  targetFields: CustomField[],
  selected: ReadonlySet<string>
): DocumentationRecord {
  const next = structuredClone(target)
  if (selected.has("description"))
    next.general.description = source.general.description
  for (const field of sourceFields) {
    if (!selected.has(`custom:${field.id}`)) continue
    const targetField = matchingField(field, targetFields)
    if (!targetField) throw new Error("incompatibleField")
    const mapped = mappedFieldValues(field, targetField, source.customFields)
    if (
      validateCustomValues([targetField], { [targetField.id]: mapped }).length
    )
      throw new Error("copyInvalidValue")
    next.customFields[targetField.id] = mapped
  }
  return next
}

export function toLocalDatetime(value: ControlValue | undefined): string {
  if (
    typeof value !== "string" ||
    !value ||
    !Number.isFinite(Date.parse(value))
  )
    return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}
