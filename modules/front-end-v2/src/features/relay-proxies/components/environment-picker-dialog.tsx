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
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState<string[]>(selected)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return environments.filter((environment) =>
      `${environment.name} ${environment.pathName} ${environment.rn}`
        .toLowerCase()
        .includes(query)
    )
  }, [environments, search])

  const groups = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, EnvironmentResource[]>>(
          (result, environment) => {
            const project = projectName(environment)
            result[project] = [...(result[project] ?? []), environment]
            return result
          },
          {}
        )
      ),
    [filtered]
  )

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(selected)
      setSearch("")
    }
    onOpenChange(nextOpen)
  }

  function toggle(resource: EnvironmentResource) {
    setDraft((current) =>
      current.includes(resource.id)
        ? current.filter((id) => id !== resource.id)
        : [...current, resource.id]
    )
  }

  const selectedResources = environments.filter((item) =>
    draft.includes(item.id)
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("relayProxies.environments.title")}</DialogTitle>
          <DialogDescription>
            {t("relayProxies.environments.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selectedResources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex w-full items-center justify-between">
                <span className="text-xs font-medium">
                  {t("relayProxies.environments.selected")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setDraft([])}
                >
                  {t("relayProxies.environments.clear")}
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
                        aria-label={t("relayProxies.environments.remove", {
                          name: resource.name,
                        })}
                        onClick={() => toggle(resource)}
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
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("relayProxies.environments.search")}
              className="pl-9"
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">
              {t("relayProxies.environments.available")}
            </h3>
            <div className="h-80 overflow-y-auto rounded-lg border">
              <div className="p-2">
                {isLoading ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {t("relayProxies.environments.loading")}
                  </p>
                ) : isError ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("relayProxies.environments.loadFailed")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={onRetry}
                    >
                      {t("relayProxies.retry")}
                    </Button>
                  </div>
                ) : groups.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {t("relayProxies.environments.empty")}
                  </p>
                ) : (
                  groups.map(([project, items]) => (
                    <section key={project} className="mb-3 last:mb-0">
                      <h3 className="px-2 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {project}
                      </h3>
                      {items.map((environment) => {
                        const checked = draft.includes(environment.id)
                        return (
                          <button
                            type="button"
                            key={environment.id}
                            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                            onClick={() => toggle(environment)}
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
                            {checked && (
                              <Check className="size-4 text-primary" />
                            )}
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
            {t("relayProxies.environments.cancel")}
          </Button>
          <Button
            disabled={draft.length === 0}
            onClick={() => {
              onApply(selectedResources)
              onOpenChange(false)
            }}
          >
            {t("relayProxies.environments.apply", { count: draft.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
