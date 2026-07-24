import { Check, Search, X } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type ResourcePickerResource = {
  id: string
  name: string
  pathName: string
  rn: string
  type: string
}

export type ResourcePickerGroup<T extends ResourcePickerResource> = {
  key: string
  label: string
  icon?: ReactNode
  items: T[]
}

type Labels = {
  title: string
  description: string
  selected: string
  search: string
  available: string
  loadFailed: string
  retry: string
  empty: string
  cancel: string
  apply: (count: number) => string
  remove: (name: string) => string
  clear?: string
  current?: string
  includedBy?: (name: string) => string
}

export function ResourcePickerDialog<T extends ResourcePickerResource>({
  open,
  resources,
  selected,
  requiredKeys = [],
  loading,
  error,
  labels,
  getKey = (resource) => resource.id,
  groupResources,
  renderResourceIcon,
  getResourceDescription = (resource) => resource.pathName,
  isChildOf,
  onOpenChange,
  onRetry,
  onApply,
}: {
  open: boolean
  resources: T[]
  selected: T[]
  requiredKeys?: string[]
  loading: boolean
  error: boolean
  labels: Labels
  getKey?: (resource: T) => string
  groupResources: (resources: T[]) => ResourcePickerGroup<T>[]
  renderResourceIcon?: (resource: T, compact: boolean) => ReactNode
  getResourceDescription?: (resource: T) => string
  isChildOf?: (child: T, parent: T) => boolean
  onOpenChange: (open: boolean) => void
  onRetry: () => void
  onApply: (resources: T[]) => void
}) {
  const initialKeys = useMemo(
    () => [...new Set([...selected.map(getKey), ...requiredKeys])],
    [getKey, requiredKeys, selected]
  )
  const [search, setSearch] = useState("")
  const [draftKeys, setDraftKeys] = useState(initialKeys)

  const draft = useMemo(
    () => resources.filter((resource) => draftKeys.includes(getKey(resource))),
    [draftKeys, getKey, resources]
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return resources.filter((resource) =>
      `${resource.name} ${resource.pathName} ${resource.rn}`
        .toLowerCase()
        .includes(query)
    )
  }, [resources, search])
  const groups = useMemo(
    () => groupResources(filtered).filter((group) => group.items.length > 0),
    [filtered, groupResources]
  )

  function toggle(resource: T) {
    const key = getKey(resource)
    if (requiredKeys.includes(key)) return

    setDraftKeys((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key)
      }
      const descendantKeys = isChildOf
        ? resources
            .filter(
              (item) =>
                isChildOf(item, resource) &&
                !requiredKeys.includes(getKey(item))
            )
            .map(getKey)
        : []
      return [...current.filter((item) => !descendantKeys.includes(item)), key]
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium">
                {labels.selected} ({draft.length})
              </h3>
              {labels.clear &&
              draftKeys.some((key) => !requiredKeys.includes(key)) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setDraftKeys(requiredKeys)}
                >
                  {labels.clear}
                </Button>
              ) : null}
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {draft.map((resource) => {
                const key = getKey(resource)
                const required = requiredKeys.includes(key)
                return (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="max-w-full gap-1 font-normal"
                    title={resource.rn}
                  >
                    {renderResourceIcon?.(resource, true)}
                    <span className="truncate">{resource.pathName}</span>
                    {required ? (
                      <span className="text-[0.65rem] text-muted-foreground">
                        {labels.current}
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={labels.remove(resource.pathName)}
                        onClick={() => toggle(resource)}
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </Badge>
                )
              })}
            </div>
          </section>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              className="pl-9"
              placeholder={labels.search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <section>
            <h3 className="mb-2 text-sm font-medium">{labels.available}</h3>
            <div className="h-80 overflow-y-auto rounded-lg border p-2">
              {loading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    {labels.loadFailed}
                  </p>
                  <Button type="button" variant="outline" onClick={onRetry}>
                    {labels.retry}
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {labels.empty}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.key}>
                    <div className="sticky top-0 z-10 flex items-center gap-2 bg-background px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {group.icon}
                      {group.label}
                    </div>
                    {group.items.map((resource) => {
                      const key = getKey(resource)
                      const explicitlySelected = draftKeys.includes(key)
                      const coveringParent = isChildOf
                        ? draft.find((item) => isChildOf(resource, item))
                        : undefined
                      const selectedByParent = Boolean(coveringParent)
                      const required = requiredKeys.includes(key)
                      const checked = explicitlySelected || selectedByParent
                      const disabled = required || selectedByParent
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted",
                            disabled && "opacity-70",
                            checked && "bg-muted/60"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            className={cn(!disabled && "cursor-pointer")}
                            onCheckedChange={() => toggle(resource)}
                          />
                          {renderResourceIcon?.(resource, false)}
                          <button
                            type="button"
                            disabled={disabled}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-not-allowed"
                            onClick={() => toggle(resource)}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 font-medium">
                                <span className="truncate">
                                  {resource.name}
                                </span>
                                {required ? (
                                  <Badge
                                    variant="outline"
                                    className="font-normal"
                                  >
                                    {labels.current}
                                  </Badge>
                                ) : null}
                              </span>
                              <span
                                className={cn(
                                  "block text-xs text-muted-foreground",
                                  getResourceDescription(resource) ===
                                    resource.rn
                                    ? "font-mono leading-4 break-all"
                                    : "truncate"
                                )}
                              >
                                {getResourceDescription(resource)}
                              </span>
                            </span>
                            {coveringParent && !required ? (
                              <span
                                className="max-w-36 shrink-0 truncate text-xs text-muted-foreground"
                                title={labels.includedBy?.(
                                  coveringParent.pathName
                                )}
                              >
                                {labels.includedBy?.(coveringParent.name)}
                              </span>
                            ) : checked ? (
                              <Check className="size-4 shrink-0" />
                            ) : null}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {labels.cancel}
          </Button>
          <Button
            type="button"
            disabled={!draft.length}
            onClick={() => onApply(draft)}
          >
            {labels.apply(draft.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
