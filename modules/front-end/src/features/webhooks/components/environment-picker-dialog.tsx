import { Box, Folder } from "lucide-react"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  ResourcePickerDialog,
  type ResourcePickerGroup,
} from "@/components/resource-picker-dialog"
import type { EnvironmentResource } from "../webhook-types"
import { resourceProjectName } from "../webhook-utils"

type Props = {
  open: boolean
  environments: EnvironmentResource[]
  selected: string[]
  isLoading: boolean
  isError: boolean
  onOpenChange: (open: boolean) => void
  onApply: (environmentIds: string[]) => void
  onRetry: () => void
}

export function EnvironmentPickerDialog({
  open,
  environments,
  selected,
  isLoading,
  isError,
  onOpenChange,
  onApply,
  onRetry,
}: Props) {
  const { t } = useTranslation()
  const selectedResources = useMemo(
    () => environments.filter((resource) => selected.includes(resource.id)),
    [environments, selected]
  )
  const groupResources = useCallback(
    (
      filtered: EnvironmentResource[]
    ): ResourcePickerGroup<EnvironmentResource>[] =>
      Object.entries(
        filtered.reduce<Record<string, EnvironmentResource[]>>(
          (result, environment) => {
            const project = resourceProjectName(environment)
            result[project] = [...(result[project] ?? []), environment]
            return result
          },
          {}
        )
      ).map(([project, items]) => ({
        key: project,
        label: project,
        icon: <Folder className="size-3.5" />,
        items,
      })),
    []
  )

  if (!open) return null

  return (
    <ResourcePickerDialog
      open={open}
      resources={environments}
      selected={selectedResources}
      loading={isLoading}
      error={isError}
      groupResources={groupResources}
      renderResourceIcon={(_, compact) => (
        <Box
          aria-hidden
          className={
            compact
              ? "size-3.5 shrink-0 text-muted-foreground"
              : "size-4 shrink-0 text-muted-foreground"
          }
        />
      )}
      getResourceDescription={(resource) => resource.rn}
      labels={{
        title: t("webhooks.environments.title"),
        description: t("webhooks.environments.description"),
        selected: t("webhooks.environments.selected"),
        search: t("webhooks.environments.search"),
        available: t("webhooks.environments.available"),
        loadFailed: t("webhooks.environments.loadFailed"),
        retry: t("webhooks.retry"),
        empty: t("webhooks.environments.empty"),
        cancel: t("webhooks.cancel"),
        apply: (count) => t("webhooks.environments.apply", { count }),
        remove: (name) => t("webhooks.environments.remove", { name }),
        clear: t("webhooks.environments.clear"),
      }}
      onOpenChange={onOpenChange}
      onRetry={onRetry}
      onApply={(resources) => {
        onApply(resources.map((resource) => resource.id))
        onOpenChange(false)
      }}
    />
  )
}
