import { z } from "zod"
import {
  customFieldSchema,
  customValuesSchema,
  type DocumentationRecord,
} from "./custom-fields-model"

const generalSchema = z.object({
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
})
const recordSchema = z.object({
  general: generalSchema,
  customFields: customValuesSchema,
})
const projectSchema = z.object({
  configured: z.boolean(),
  fields: z.array(customFieldSchema),
  records: z.record(z.string(), recordSchema),
  history: z.array(
    z.object({
      id: z.string(),
      flagKey: z.string(),
      envId: z.string(),
      at: z.string(),
      comment: z.string(),
      previous: recordSchema,
      current: recordSchema,
    })
  ),
  configurationHistory: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      previous: z.array(customFieldSchema),
      current: z.array(customFieldSchema),
    })
  ),
})
export type CustomFieldsProject = z.infer<typeof projectSchema>
export const customFieldsStorageKey = (projectId: string) =>
  `featbit:flag-custom-fields:v2:${projectId}`
export const documentationRecordKey = (envId: string, flagKey: string) =>
  `${envId}:${flagKey}`
export const customFieldsChangedEvent = "featbit:flag-custom-fields-changed"
export function emptyCustomFieldsProject(): CustomFieldsProject {
  return {
    configured: false,
    fields: [],
    records: {},
    history: [],
    configurationHistory: [],
  }
}

export function readCustomFieldsProject(
  projectId: string
): CustomFieldsProject {
  try {
    const raw = localStorage.getItem(customFieldsStorageKey(projectId))
    if (raw) return projectSchema.parse(JSON.parse(raw))
    return emptyCustomFieldsProject()
  } catch {
    return emptyCustomFieldsProject()
  }
}

export function writeCustomFieldsProject(
  projectId: string,
  state: CustomFieldsProject
) {
  localStorage.setItem(customFieldsStorageKey(projectId), JSON.stringify(state))
  window.dispatchEvent(
    new CustomEvent(customFieldsChangedEvent, { detail: { projectId } })
  )
}

export function saveDocumentationRecord(
  projectId: string,
  envId: string,
  flagKey: string,
  current: DocumentationRecord,
  previous: DocumentationRecord,
  comment: string
) {
  const latest = readCustomFieldsProject(projectId)
  const key = documentationRecordKey(envId, flagKey)
  writeCustomFieldsProject(projectId, {
    ...latest,
    records: { ...latest.records, [key]: current },
    history: [
      {
        id: crypto.randomUUID(),
        flagKey,
        envId,
        at: new Date().toISOString(),
        comment,
        previous: latest.records[key] ?? previous,
        current,
      },
      ...latest.history,
    ],
  })
}
