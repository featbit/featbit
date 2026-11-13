import { useCallback, useMemo, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"
import { customFieldSchema, type CustomField } from "./custom-fields-model"
import {
  customFieldsChangedEvent,
  customFieldsStorageKey,
  readCustomFieldsProject,
  writeCustomFieldsProject,
  type CustomFieldsProject,
} from "./custom-fields-storage"

export function useProjectCustomFields(
  projectId: string,
  canConfigure = false
) {
  const { t } = useDocumentationCopy()
  const subscribe = useCallback(
    (notify: () => void) => {
      const changed = (event: Event) => {
        if (
          (event as CustomEvent<{ projectId: string }>).detail.projectId ===
          projectId
        )
          notify()
      }
      const storage = (event: StorageEvent) => {
        if (
          event.key === customFieldsStorageKey(projectId) ||
          event.key === null
        )
          notify()
      }
      window.addEventListener(customFieldsChangedEvent, changed)
      window.addEventListener("storage", storage)
      return () => {
        window.removeEventListener(customFieldsChangedEvent, changed)
        window.removeEventListener("storage", storage)
      }
    },
    [projectId]
  )
  const snapshot = useSyncExternalStore(subscribe, () =>
    JSON.stringify(readCustomFieldsProject(projectId))
  )
  const state = useMemo(
    () => JSON.parse(snapshot) as CustomFieldsProject,
    [snapshot]
  )
  function saveField(field: CustomField | null, removedId?: string) {
    if (!canConfigure) {
      toast.error(t("projectPermission"))
      return false
    }
    if (field && !customFieldSchema.safeParse(field).success) {
      toast.error(t("invalidValue"))
      return false
    }
    const latest = readCustomFieldsProject(projectId)
    const fields = field
      ? latest.fields.some((item) => item.id === field.id)
        ? latest.fields.map((item) => (item.id === field.id ? field : item))
        : [...latest.fields, field]
      : latest.fields.filter((item) => item.id !== removedId)
    if (
      new Set(fields.map((item) => item.name.toLowerCase().trim())).size !==
      fields.length
    ) {
      toast.error(t("duplicateField"))
      return false
    }
    try {
      writeCustomFieldsProject(projectId, {
        ...latest,
        configured: true,
        fields,
        configurationHistory: [
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            previous: latest.fields,
            current: fields,
          },
          ...latest.configurationHistory,
        ],
      })
      return true
    } catch {
      toast.error(t("storageError"))
      return false
    }
  }
  return {
    state,
    fields: state.fields,
    saveField,
  }
}
