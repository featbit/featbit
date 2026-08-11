import { Box, Folder } from "lucide-react"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  ResourcePickerDialog,
  type ResourcePickerGroup,
} from "@/components/resource-picker-dialog"
import type { EnvironmentResource } from "../relay-proxy-types"

type Props = {
  open: boolean
  environments: EnvironmentResource[]
  selected: string[]
  isLoading: boolean
  isError: boolean
  onOpenChange: (open: boolean) => void
  onApply: (resources: EnvironmentResource[]) => void
  onRetry: () => void
}

function projectName(resource: EnvironmentResource) {
  const parts = resource.pathName.split("/").filter(Boolean)
  return parts.length > 1 ? (parts.at(-2) ?? "Project") : "Project"
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
            const project = projectName(environment)
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
        title: t("relayProxies.environments.title"),
        description: t("relayProxies.environments.description"),
        selected: t("relayProxies.environments.selected"),
        search: t("relayProxies.environments.search"),
        available: t("relayProxies.environments.available"),
        loadFailed: t("relayProxies.environments.loadFailed"),
        retry: t("relayProxies.retry"),
        empty: t("relayProxies.environments.empty"),
        cancel: t("relayProxies.environments.cancel"),
        apply: (count) => t("relayProxies.environments.apply", { count }),
        remove: (name) => t("relayProxies.environments.remove", { name }),
        clear: t("relayProxies.environments.clear"),
      }}
      onOpenChange={onOpenChange}
      onRetry={onRetry}
      onApply={(resources) => {
        onApply(resources)
        onOpenChange(false)
      }}
    />
  )
}
