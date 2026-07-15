import {
  CheckCircle2,
  ChevronsUpDown,
  Globe2,
  ListChecks,
  X,
} from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { SelectableCommandList } from "@/components/selectable-command-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { fetchPolicyResources } from "../policy-details-api"
import {
  RESOURCE_PATTERNS,
  SPECIFIC_RESOURCE_TYPES,
  resourceDisplayName,
  type PolicyResource,
  type ResourceType,
} from "../permission-model"

type ScopeMode = "all" | "specific"

export function ResourcePicker({
  resourceType,
  resources,
  disabled,
  invalid,
  onChange,
}: {
  resourceType: ResourceType
  resources: string[]
  disabled?: boolean
  invalid?: boolean
  onChange: (resources: string[]) => void
}) {
  const { t } = useTranslation()
  const scopeDescriptionId = useId()
  const supportsSpecific = SPECIFIC_RESOURCE_TYPES.has(resourceType)
  const selectedResourceType = t(
    `iam.policies.details.permissionsEditor.resourceTypePlurals.${resourceType}`,
    { defaultValue: resourceType }
  )
  const generalPattern = RESOURCE_PATTERNS[resourceType]
  const mode: ScopeMode = resources.includes(generalPattern)
    ? "all"
    : "specific"
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<"all" | "selected">("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<PolicyResource[]>([])
  const [draft, setDraft] = useState<string[]>(resources)

  useEffect(() => {
    if (!open || mode !== "specific") return
    let cancelled = false
    const timeout = window.setTimeout(() => {
      fetchPolicyResources(search, resourceType)
        .then((items) => {
          if (!cancelled) setOptions(Array.isArray(items) ? items : [])
        })
        .catch(() => {
          if (!cancelled) setOptions([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [mode, open, resourceType, search])

  const mergedOptions = useMemo(() => {
    const byRn = new Map(options.map((item) => [item.rn, item]))
    draft.forEach((rn) => {
      if (!byRn.has(rn)) {
        byRn.set(rn, {
          id: rn,
          rn,
          name: resourceDisplayName(rn),
          type: resourceType,
        })
      }
    })
    const values = [...byRn.values()]
    const searched = search.trim().toLowerCase()
    const visible =
      filter === "selected"
        ? values.filter((item) => draft.includes(item.rn))
        : values
    return searched
      ? visible.filter((item) =>
          `${item.name} ${item.rn}`.toLowerCase().includes(searched)
        )
      : visible
  }, [draft, filter, options, resourceType, search])

  const selectedResources = useMemo(
    () =>
      draft.map((rn) => ({
        rn,
        name:
          options.find((item) => item.rn === rn)?.name ??
          resourceDisplayName(rn),
      })),
    [draft, options]
  )

  function changeMode(next: ScopeMode) {
    if (next === "all") {
      onChange([generalPattern])
      setOpen(false)
      return
    }
    onChange([])
    setDraft([])
    setLoading(true)
    setOpen(true)
  }

  function toggle(rn: string) {
    setDraft((current) =>
      current.includes(rn)
        ? current.filter((item) => item !== rn)
        : [...current, rn]
    )
  }

  function removeSelected(rn: string) {
    const next = draft.filter((item) => item !== rn)
    setDraft(next)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {supportsSpecific ? (
        <div className="grid gap-x-2 gap-y-1 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            aria-pressed={mode === "all"}
            aria-describedby={scopeDescriptionId}
            className={cn(
              "h-10 justify-start gap-2 px-3 text-left whitespace-normal",
              mode === "all" &&
                "border-primary bg-primary/5 hover:border-primary hover:bg-primary/10"
            )}
            disabled={disabled}
            onClick={() => changeMode("all")}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                mode === "all" && "bg-primary text-primary-foreground"
              )}
            >
              <Globe2 className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {t("iam.policies.details.permissionsEditor.allResources")}
            </span>
            {mode === "all" ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
            ) : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={mode === "specific"}
            aria-describedby={scopeDescriptionId}
            className={cn(
              "h-10 justify-start gap-2 px-3 text-left whitespace-normal",
              mode === "specific" &&
                "border-primary bg-primary/5 hover:border-primary hover:bg-primary/10"
            )}
            disabled={disabled}
            onClick={() => changeMode("specific")}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                mode === "specific" && "bg-primary text-primary-foreground"
              )}
            >
              <ListChecks className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {t("iam.policies.details.permissionsEditor.specificResources")}
            </span>
            {mode === "specific" ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
            ) : null}
          </Button>
          <p
            id={scopeDescriptionId}
            className="text-xs text-muted-foreground sm:col-span-2"
          >
            {mode === "all"
              ? t(
                  "iam.policies.details.permissionsEditor.allResourcesDescription"
                )
              : t(
                  "iam.policies.details.permissionsEditor.specificResourcesDescription"
                )}
          </p>
        </div>
      ) : (
        <div className="grid gap-x-2 gap-y-1 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            aria-pressed={true}
            aria-describedby={scopeDescriptionId}
            className="h-10 justify-start gap-2 border-primary bg-primary/5 px-3 text-left whitespace-normal hover:border-primary hover:bg-primary/10"
            disabled={disabled}
            onClick={() => changeMode("all")}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Globe2 className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {t("iam.policies.details.permissionsEditor.allResources")}
            </span>
            <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
          </Button>
          <p
            id={scopeDescriptionId}
            className="text-xs text-muted-foreground sm:col-span-2"
          >
            {t(
              "iam.policies.details.permissionsEditor.allResourcesDescription"
            )}
          </p>
        </div>
      )}

      {mode === "specific" ? (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            setLoading(next)
            if (next) setDraft(resources)
          }}
        >
          <div
            className={cn(
              "overflow-hidden rounded-lg border bg-background",
              invalid && "border-destructive"
            )}
          >
            <div className="flex min-h-9 items-center justify-between gap-3 border-b px-3 py-1.5">
              <span className="min-w-0 truncate text-xs font-medium text-foreground">
                {t(
                  "iam.policies.details.permissionsEditor.selectedResourcesHeading",
                  {
                    count: draft.length,
                    type: selectedResourceType,
                  }
                )}
              </span>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2 text-xs"
                    disabled={disabled}
                  >
                    {t(
                      "iam.policies.details.permissionsEditor.manageResources"
                    )}
                    <ChevronsUpDown className="size-3.5" />
                  </Button>
                }
              />
            </div>
            {selectedResources.length ? (
              <div className="max-h-28 overflow-y-auto p-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedResources.map((resource) => (
                    <Badge
                      key={resource.rn}
                      variant="secondary"
                      className="max-w-full gap-1 rounded-full border-border py-0.5 pr-1 pl-2 font-normal"
                    >
                      <span
                        className="max-w-56 min-w-0 truncate"
                        title={`${resource.name}\n${resource.rn}`}
                      >
                        {resource.name}
                      </span>
                      <button
                        type="button"
                        aria-label={t(
                          "iam.policies.details.permissionsEditor.removeSelectedResource",
                          { name: resource.name }
                        )}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => removeSelected(resource.rn)}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                {t(
                  "iam.policies.details.permissionsEditor.noSelectedResources"
                )}
              </p>
            )}
          </div>
          <PopoverContent
            align="start"
            className="w-[min(32rem,calc(100vw-2rem))] p-0"
          >
            <Command shouldFilter={false} className="rounded-md">
              <CommandInput
                value={search}
                onValueChange={(value) => {
                  setLoading(true)
                  setSearch(value)
                }}
                placeholder={t(
                  "iam.policies.details.permissionsEditor.searchResources"
                )}
              />
              <div className="flex gap-5 border-b px-3 pt-2">
                {(["all", "selected"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "border-b-2 px-0.5 pb-2 text-sm font-medium",
                      filter === value
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground"
                    )}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all"
                      ? t("iam.policies.details.permissionsEditor.allFilter")
                      : t(
                          "iam.policies.details.permissionsEditor.selectedFilter",
                          {
                            count: draft.length,
                          }
                        )}
                  </button>
                ))}
              </div>
              <SelectableCommandList
                items={mergedOptions}
                getKey={(item) => item.rn}
                getValue={(item) => item.rn}
                isSelected={(item) => draft.includes(item.rn)}
                onSelect={(item) => toggle(item.rn)}
                emptyContent={t(
                  "iam.policies.details.permissionsEditor.noResources"
                )}
                groupHeading={t(
                  "iam.policies.details.permissionsEditor.availableResources"
                )}
                loading={loading}
                loadingContent={
                  <div
                    className="h-full space-y-2 p-2"
                    aria-label={t(
                      "iam.policies.details.permissionsEditor.loadingResources"
                    )}
                  >
                    <span className="sr-only">
                      {t(
                        "iam.policies.details.permissionsEditor.loadingResources"
                      )}
                    </span>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-11/12" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-4/5" />
                  </div>
                }
                listClassName="h-[clamp(10rem,40dvh,18rem)] max-h-none [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto [&_[data-slot=command-empty]]:flex [&_[data-slot=command-empty]]:h-full [&_[data-slot=command-empty]]:items-center [&_[data-slot=command-empty]]:justify-center [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
                renderItem={(item) => (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {item.rn}
                    </span>
                  </span>
                )}
              />
            </Command>
            <div className="flex items-center justify-between border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraft([])}
                disabled={!draft.length}
              >
                {t("iam.policies.details.permissionsEditor.clearAll")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange(draft)
                  setOpen(false)
                }}
              >
                {t("iam.policies.details.permissionsEditor.done")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
