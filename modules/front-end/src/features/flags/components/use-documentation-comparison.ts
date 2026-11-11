import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { currentUserPoliciesQueryOptions } from "@/features/iam/current-user-policy-query"
import {
  fetchProjects,
  getCurrentOrganization,
  getCurrentWorkspace,
} from "@/features/layout/layout-context"
import { isFineGrainedAccessControlGranted } from "@/features/workspace/license/license-utils"
import { fetchFeatureFlag } from "../flags-api"
import {
  canUseFlagAction,
  environmentRn,
  featureFlagRn,
} from "../flags-permissions"
import type { UserPolicy } from "../flags-types"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"
import {
  copyDocumentation,
  documentationRows,
  type DocumentationSettingKey,
} from "../custom-fields/custom-fields-model"
import {
  customFieldsChangedEvent,
  documentationRecordKey,
  readCustomFieldsProject,
  saveDocumentationRecord,
} from "../custom-fields/custom-fields-storage"
import { flagSettingsOf } from "../details/settings/settings-utils"

export function useDocumentationComparison(
  sourceId: string,
  targetId: string,
  flagKey: string,
  enabled: boolean
) {
  const { t } = useDocumentationCopy()
  const organizationId = getCurrentOrganization()?.id ?? ""
  const fineGrained = isFineGrainedAccessControlGranted(
    getCurrentWorkspace()?.license
  )
  const [, setRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener(customFieldsChangedEvent, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(customFieldsChangedEvent, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])
  const projects = useQuery({
    queryKey: ["projects", "flag-differences"],
    queryFn: fetchProjects,
    enabled,
    staleTime: 300_000,
  })
  const sourceProject = projects.data?.find((project) =>
    project.environments.some((env) => env.id === sourceId)
  )
  const targetProject = projects.data?.find((project) =>
    project.environments.some((env) => env.id === targetId)
  )
  const sourceQuery = useQuery({
    queryKey: ["feature-flag-details", sourceId, flagKey],
    queryFn: () => fetchFeatureFlag(sourceId, flagKey),
    enabled: enabled && Boolean(sourceId && flagKey),
    retry: false,
  })
  const targetQuery = useQuery({
    queryKey: ["feature-flag-details", targetId, flagKey],
    queryFn: () => fetchFeatureFlag(targetId, flagKey),
    enabled: enabled && Boolean(targetId && flagKey),
    retry: false,
  })
  const policies = useQuery({
    ...currentUserPoliciesQueryOptions<UserPolicy>(organizationId),
    enabled: enabled && Boolean(organizationId),
    staleTime: 300_000,
  })
  const sourceState = readCustomFieldsProject(sourceProject?.id ?? "")
  const targetState = readCustomFieldsProject(targetProject?.id ?? "")
  const source = sourceQuery.data
    ? (sourceState.records[documentationRecordKey(sourceId, flagKey)] ?? {
        general: flagSettingsOf(sourceQuery.data),
        customFields: {},
      })
    : null
  const target = targetQuery.data
    ? (targetState.records[documentationRecordKey(targetId, flagKey)] ?? {
        general: flagSettingsOf(targetQuery.data),
        customFields: {},
      })
    : null
  const rows =
    source && target
      ? documentationRows(
          source,
          sourceState.fields,
          target,
          targetState.fields
        )
      : []
  const targetEnvironment = targetProject?.environments.find(
    (env) => env.id === targetId
  )
  const canEdit = Boolean(
    targetQuery.data &&
    targetEnvironment &&
    policies.isSuccess &&
    !targetQuery.data.isArchived &&
    canUseFlagAction(
      policies.data,
      featureFlagRn(
        environmentRn({
          projectKey: targetProject!.key,
          environmentKey: targetEnvironment.key ?? "",
        }),
        targetQuery.data
      ),
      "UpdateFlagDescription",
      fineGrained
    )
  )
  const ready = Boolean(source && target && sourceProject && targetProject)

  function prepare(selected: ReadonlySet<string>) {
    if (!source || !target || !sourceProject || !targetProject || !canEdit)
      throw new Error(t("copyPermissionHelp"))
    function stage() {
      const latestSource = readCustomFieldsProject(sourceProject!.id)
      const latestTarget = readCustomFieldsProject(targetProject!.id)
      const currentSource =
        latestSource.records[documentationRecordKey(sourceId, flagKey)] ??
        source!
      const currentTarget =
        latestTarget.records[documentationRecordKey(targetId, flagKey)] ??
        target!
      try {
        return {
          previous: currentTarget,
          current: copyDocumentation(
            currentSource,
            latestSource.fields,
            currentTarget,
            latestTarget.fields,
            selected
          ),
        }
      } catch (error) {
        throw new Error(
          t(
            error instanceof Error && error.message === "incompatibleField"
              ? "incompatibleField"
              : "copyInvalidValue"
          ),
          { cause: error }
        )
      }
    }
    stage()
    return () => {
      // Re-read after the runtime copy to preserve unselected target values.
      const { previous, current } = stage()
      saveDocumentationRecord(
        targetProject.id,
        targetId,
        flagKey,
        current,
        previous,
        `Copied settings from ${sourceProject.name} / ${sourceProject.environments.find((env) => env.id === sourceId)?.name ?? sourceId}`
      )
    }
  }
  function errorFor(key: DocumentationSettingKey) {
    if (!rows.find((row) => row.key === key)?.different) return ""
    try {
      prepare(new Set([key]))
      return ""
    } catch (error) {
      return error instanceof Error ? error.message : t("copyValidationHelp")
    }
  }
  return {
    source,
    target,
    rows,
    ready,
    canEdit,
    prepare,
    errorFor,
    loading:
      enabled &&
      (projects.isPending || sourceQuery.isPending || targetQuery.isPending),
    error: projects.isError || sourceQuery.isError || targetQuery.isError,
  }
}
