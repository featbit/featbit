import { useMemo } from "react"
import { toast } from "sonner"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"
import type {
  CustomFieldValues,
  DocumentationRecord,
} from "./custom-fields-model"
import {
  documentationRecordKey,
  saveDocumentationRecord,
} from "./custom-fields-storage"
import { useProjectCustomFields } from "./use-project-custom-fields"
import type { FlagSettingsValues } from "../details/settings/settings-utils"

export function useCustomFields(envId: string, flagKey: string) {
  const { t } = useDocumentationCopy()
  const projectId = getCurrentProjectEnv()?.projectId || envId
  const { state, fields } = useProjectCustomFields(projectId)
  const recordSnapshot = JSON.stringify(
    state.records[documentationRecordKey(envId, flagKey)] ?? null
  )
  const savedRecord = useMemo(
    () => JSON.parse(recordSnapshot) as DocumentationRecord | null,
    [recordSnapshot]
  )
  function saveRecord(
    general: FlagSettingsValues,
    values: CustomFieldValues,
    comment: string,
    previousGeneral: FlagSettingsValues
  ) {
    try {
      saveDocumentationRecord(
        projectId,
        envId,
        flagKey,
        { general, customFields: values },
        { general: previousGeneral, customFields: {} },
        comment
      )
      return true
    } catch {
      toast.error(t("storageError"))
      return false
    }
  }
  return { fields, savedRecord, saveRecord }
}
