import { useQuery } from "@tanstack/react-query"
import { LoaderCircle, Pencil, Plus, X } from "lucide-react"
import { useEffect, useState, type ReactElement, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { StablePopoverContent } from "@/components/stable-popover-content"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ResourceRnEditorDialog } from "@/features/iam/policies/details/components/resource-rn-editor-dialog"
import { isEditableResourceType } from "@/features/iam/policies/details/components/resource-rn"
import { fetchAccessTokenResources } from "../access-tokens-api"
import { resourcePathLabel } from "../access-token-permissions"
import type { PolicyResource, ResourceType } from "../access-token-types"

function ResourcePickerPopover({
  portalContainer,
  resourceType,
  resources,
  onChange,
  children,
}: {
  portalContainer: RefObject<HTMLDivElement | null>
  resourceType: ResourceType
  resources: string[]
  onChange: (resources: string[]) => void
  children: ReactElement
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const resourcesQuery = useQuery({
    queryKey: ["access-token-resource-options", resourceType, debouncedSearch],
    queryFn: () => fetchAccessTokenResources(debouncedSearch, resourceType),
    enabled: open,
    staleTime: 30_000,
  })

  function selectResource(resource: PolicyResource) {
    onChange(
      resources.includes(resource.rn)
        ? resources.filter((item) => item !== resource.rn)
        : [...resources, resource.rn]
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setSearch("")
      }}
    >
      <PopoverTrigger render={children} />
      <StablePopoverContent
        portalContainer={portalContainer}
        align="start"
        className="w-96 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t("accessTokens.permissions.searchResources")}
          />
          <CommandList>
            {resourcesQuery.isFetching ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                {t("accessTokens.permissions.loadingResources")}
              </div>
            ) : null}
            {!resourcesQuery.isFetching ? (
              <CommandEmpty>
                {t("accessTokens.permissions.noResources")}
              </CommandEmpty>
            ) : null}
            <CommandGroup
              heading={t("accessTokens.permissions.availableResources")}
            >
              {(resourcesQuery.data ?? []).map((resource) => {
                const selected = resources.includes(resource.rn)
                return (
                  <CommandItem
                    key={resource.rn}
                    value={resource.rn}
                    data-checked={selected}
                    onSelect={() => selectResource(resource)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{resource.name}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {resource.rn}
                      </span>
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex justify-end border-t p-2">
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {t("accessTokens.permissions.done")}
          </Button>
        </div>
      </StablePopoverContent>
    </Popover>
  )
}

export function ResourceSelection({
  portalContainer,
  resourceType,
  resources,
  readOnly,
  invalid,
  onChange,
}: {
  portalContainer: RefObject<HTMLDivElement | null>
  resourceType: ResourceType
  resources: string[]
  readOnly: boolean
  invalid: boolean
  onChange: (resources: string[]) => void
}) {
  const { t } = useTranslation()
  const [editingResource, setEditingResource] = useState<string | null>(null)

  return (
    <div className="space-y-2" aria-invalid={invalid || undefined}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium text-muted-foreground">
          {t("accessTokens.permissions.selectedResources", {
            count: resources.length,
          })}
        </p>
        {!readOnly ? (
          <ResourcePickerPopover
            portalContainer={portalContainer}
            resourceType={resourceType}
            resources={resources}
            onChange={onChange}
          >
            <Button type="button" variant="outline" size="sm">
              <Plus className="size-3.5" />
              {t("accessTokens.permissions.addResource")}
            </Button>
          </ResourcePickerPopover>
        ) : null}
      </div>

      {resources.length ? (
        <div className="space-y-2">
          {resources.map((resourceName) => {
            const label = resourcePathLabel(resourceName)
            return (
              <div
                key={resourceName}
                className="flex h-8 w-full min-w-0 items-stretch overflow-hidden rounded-md border bg-background"
              >
                {readOnly ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="flex min-w-0 flex-1 items-center px-3 font-mono text-xs" />
                      }
                    >
                      <span className="truncate">{resourceName}</span>
                    </TooltipTrigger>
                    <TooltipContent>{resourceName}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto min-w-0 flex-1 justify-between gap-3 rounded-none px-3 font-mono text-xs font-normal"
                          aria-label={t(
                            "accessTokens.permissions.editResource",
                            { resource: label }
                          )}
                          onClick={() => setEditingResource(resourceName)}
                        />
                      }
                    >
                      <span className="truncate">{resourceName}</span>
                      <Pencil className="size-3 shrink-0 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>{resourceName}</TooltipContent>
                  </Tooltip>
                )}
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-none border-l text-muted-foreground hover:text-foreground"
                    aria-label={t("accessTokens.permissions.removeResource", {
                      resource: label,
                    })}
                    onClick={() =>
                      onChange(
                        resources.filter((item) => item !== resourceName)
                      )
                    }
                  >
                    <X className="size-3" />
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("accessTokens.permissions.noResourcesSelected")}
        </p>
      )}

      {invalid ? (
        <p className="text-xs text-destructive">
          {t("accessTokens.permissions.selectAtLeastOneResource")}
        </p>
      ) : null}

      {editingResource && isEditableResourceType(resourceType) ? (
        <ResourceRnEditorDialog
          open
          resourceType={resourceType}
          rn={editingResource}
          selectedResources={resources}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingResource(null)
          }}
          onApply={(nextRn) => {
            onChange(
              resources.map((resource) =>
                resource === editingResource ? nextRn : resource
              )
            )
            setEditingResource(null)
          }}
        />
      ) : null}
    </div>
  )
}
