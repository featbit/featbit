import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  ResourcePickerDialog,
  type ResourcePickerGroup,
} from "@/components/resource-picker-dialog"
import type { ScopeResource } from "../../segments-types"
import { scopeResourceGroups } from "./scope-resource-groups"
import { ScopeResourceIcon } from "./scope-resource-icon"

function isChildOf(child: ScopeResource, parent: ScopeResource) {
  return child.rn !== parent.rn && `${child.rn}:`.startsWith(`${parent.rn}:`)
}

export function ScopePickerDialog({
  open,
  resources,
  selected,
  currentEnvironmentRn,
  loading,
  error,
  onOpenChange,
  onRetry,
  onApply,
}: {
  open: boolean
  resources: ScopeResource[]
  selected: ScopeResource[]
  currentEnvironmentRn: string
  loading: boolean
  error: boolean
  onOpenChange: (open: boolean) => void
  onRetry: () => void
  onApply: (resources: ScopeResource[]) => void
}) {
  const { t } = useTranslation()
  const groupResources = useCallback(
    (filtered: ScopeResource[]): ResourcePickerGroup<ScopeResource>[] =>
      scopeResourceGroups.map((group) => ({
        key: group.type,
        label: t(group.labelKey),
        icon: <ScopeResourceIcon type={group.type} className="size-3.5" />,
        items: filtered.filter((resource) => resource.type === group.type),
      })),
    [t]
  )

  if (!open) return null

  return (
    <ResourcePickerDialog
      open={open}
      resources={resources}
      selected={selected}
      requiredKeys={[currentEnvironmentRn]}
      loading={loading}
      error={error}
      getKey={(resource) => resource.rn}
      groupResources={groupResources}
      renderResourceIcon={(resource, compact) => (
        <ScopeResourceIcon
          type={resource.type}
          className={compact ? "size-3.5" : undefined}
        />
      )}
      isChildOf={isChildOf}
      labels={{
        title: t("segments.scopes.title"),
        description: t("segments.scopes.description"),
        selected: t("segments.scopes.selected"),
        search: t("segments.scopes.search"),
        available: t("segments.scopes.available"),
        loadFailed: t("segments.scopes.loadFailed"),
        retry: t("segments.retry"),
        empty: t("segments.scopes.empty"),
        cancel: t("segments.scopes.cancel"),
        apply: (count) => t("segments.scopes.apply", { count }),
        remove: (name) => t("segments.scopes.remove", { name }),
        current: t("segments.create.current"),
        includedBy: (name) => t("segments.scopes.includedBy", { name }),
      }}
      onOpenChange={onOpenChange}
      onRetry={onRetry}
      onApply={onApply}
    />
  )
}
