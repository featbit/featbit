import { Check, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  if (!open) return null

  return (
    <EnvironmentPickerDialogContent
      environments={environments}
      selected={selected}
      isLoading={isLoading}
      isError={isError}
      onOpenChange={onOpenChange}
      onApply={onApply}
      onRetry={onRetry}
    />
  )
}

function EnvironmentPickerDialogContent({
  environments,
  selected,
  isLoading,
  isError,
  onOpenChange,
  onApply,
  onRetry,
}: Omit<Props, "open">) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState<string[]>(selected)

  const selectedResources = useMemo(
    () => environments.filter((item) => draft.includes(item.id)),
    [draft, environments]
  )
  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = environments.filter((environment) =>
      `${environment.name} ${environment.pathName} ${environment.rn}`
        .toLowerCase()
        .includes(query)
    )
    return Object.entries(
      filtered.reduce<Record<string, EnvironmentResource[]>>(
        (result, environment) => {
          const project = resourceProjectName(environment)
          result[project] = [...(result[project] ?? []), environment]
          return result
        },
        {}
      )
    )
  }, [environments, search])

  function toggle(environmentId: string) {
    setDraft((current) =>
      current.includes(environmentId)
        ? current.filter((id) => id !== environmentId)
        : [...current, environmentId]
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("webhooks.environments.title")}</DialogTitle>
          <DialogDescription>
            {t("webhooks.environments.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selectedResources.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex w-full items-center justify-between">
                <span className="text-xs font-medium">
                  {t("webhooks.environments.selected")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setDraft([])}
                >
                  {t("webhooks.environments.clear")}
                </Button>
              </div>
              <TooltipProvider delay={300}>
                {selectedResources.map((resource) => (
                  <Tooltip key={resource.id}>
                    <TooltipTrigger
                      render={<Badge variant="secondary" className="gap-1" />}
                    >
                      {resource.pathName}
                      <button
                        type="button"
                        aria-label={t("webhooks.environments.remove", {
                          name: resource.name,
                        })}
                        onClick={() => toggle(resource.id)}
                      >
                        <X className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[min(28rem,calc(100vw-2rem))] font-mono break-all">
                      {resource.rn}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          ) : null}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("webhooks.environments.search")}
              className="pl-9"
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">
              {t("webhooks.environments.available")}
            </h3>
            <div className="h-80 overflow-y-auto rounded-lg border">
              <div className="p-2">
                {isLoading ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {t("webhooks.environments.loading")}
                  </p>
                ) : isError ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("webhooks.environments.loadFailed")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={onRetry}
                    >
                      {t("webhooks.retry")}
                    </Button>
                  </div>
                ) : groups.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {t("webhooks.environments.empty")}
                  </p>
                ) : (
                  groups.map(([project, items]) => (
                    <section key={project} className="mb-3 last:mb-0">
                      <h3 className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {project}
                      </h3>
                      {items.map((environment) => {
                        const checked = draft.includes(environment.id)
                        return (
                          <button
                            type="button"
                            key={environment.id}
                            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                            onClick={() => toggle(environment.id)}
                          >
                            <Checkbox checked={checked} tabIndex={-1} />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">
                                {environment.name}
                              </span>
                              <span className="block font-mono text-xs leading-4 break-all text-muted-foreground">
                                {environment.rn}
                              </span>
                            </span>
                            {checked ? (
                              <Check className="size-4 text-primary" />
                            ) : null}
                          </button>
                        )
                      })}
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("webhooks.cancel")}
          </Button>
          <Button
            disabled={draft.length === 0}
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
          >
            {t("webhooks.environments.apply", { count: draft.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
