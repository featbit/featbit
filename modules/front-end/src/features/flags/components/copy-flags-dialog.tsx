import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  CircleX,
  Loader2,
  Lock,
  ShieldAlert,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fetchProjects,
  getCurrentProjectEnv,
  localizedPath,
} from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import { copyFeatureFlags, precheckCopyFeatureFlags } from "../flags-api"
import type { CopyPrecheckResult, FeatureFlag } from "../flags-types"

function hasLimitations(result: CopyPrecheckResult) {
  return result.keyCheck && (!result.targetUserCheck || !result.targetRuleCheck)
}

export function CopyFlagsDialog({
  lang,
  envId,
  flags,
  open,
  lockedTarget = null,
  onOpenChange,
  onSuccess,
}: {
  lang: Lang
  envId: string
  flags: FeatureFlag[]
  open: boolean
  lockedTarget?: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const source = getCurrentProjectEnv()
  const [selectedTargetEnvId, setSelectedTargetEnvId] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionTouched, setSelectionTouched] = useState(false)
  const targetEnvId = lockedTarget?.id ?? selectedTargetEnvId

  const projectsQuery = useQuery({
    queryKey: ["projects", "flag-copy"],
    queryFn: fetchProjects,
    enabled: open && !lockedTarget,
    staleTime: 60_000,
  })
  const precheckQuery = useQuery({
    queryKey: [
      "feature-flag-copy-precheck",
      envId,
      targetEnvId,
      flags.map((flag) => flag.id).join(","),
    ],
    queryFn: () =>
      precheckCopyFeatureFlags(
        envId,
        targetEnvId,
        flags.map((flag) => flag.id)
      ),
    enabled: open && Boolean(targetEnvId) && flags.length > 0,
  })

  const results = useMemo(
    () =>
      new Map((precheckQuery.data ?? []).map((result) => [result.id, result])),
    [precheckQuery.data]
  )
  const defaultSelectedIds = useMemo(
    () =>
      new Set(
        (precheckQuery.data ?? [])
          .filter((result) => result.keyCheck && !hasLimitations(result))
          .map((result) => result.id)
      ),
    [precheckQuery.data]
  )
  const activeSelectedIds = selectionTouched ? selectedIds : defaultSelectedIds
  const selectedCount = activeSelectedIds.size
  const copyUnavailable =
    precheckQuery.error instanceof Error &&
    /forbidden|permission|license/i.test(precheckQuery.error.message)

  const mutation = useMutation({
    mutationFn: () =>
      copyFeatureFlags(
        envId,
        targetEnvId,
        [...activeSelectedIds],
        precheckQuery.data ?? []
      ),
    onSuccess: (result) => {
      toast.success(
        t("featureFlags.copyDialog.copied", { count: result.copiedCount })
      )
      onSuccess()
      onOpenChange(false)
    },
    onError: () => toast.error(t("featureFlags.copyDialog.failed")),
  })

  const targetProjects = (projectsQuery.data ?? [])
    .map((project) => ({
      ...project,
      environments: project.environments.filter(
        (environment) => environment.id !== envId
      ),
    }))
    .filter((project) => project.environments.length)
  const selectedTarget = targetProjects
    .flatMap((project) =>
      project.environments.map((environment) => ({
        id: environment.id,
        name: `${project.name} / ${environment.name}`,
      }))
    )
    .find((environment) => environment.id === targetEnvId)
  const licenseHref =
    getRuntimeEnv().hostingMode === "saas"
      ? "/workspace/billing"
      : "/workspace/license"

  function resetSelection() {
    setSelectedIds(new Set())
    setSelectionTouched(false)
  }

  function toggleSelection(id: string, allowed: boolean) {
    if (!allowed || mutation.isPending) return
    setSelectedIds(() => {
      const next = new Set(activeSelectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectionTouched(true)
  }

  function setWarningIncluded(id: string, included: boolean) {
    setSelectedIds(() => {
      const next = new Set(activeSelectedIds)
      if (included) next.add(id)
      else next.delete(id)
      return next
    })
    setSelectionTouched(true)
  }

  function renderFlagIdentity(flag: FeatureFlag) {
    const result = results.get(flag.id)
    const allowed = Boolean(result?.keyCheck)
    const warning = Boolean(result && hasLimitations(result))
    return (
      <div className="flex min-w-0 items-start gap-3 px-3 py-3">
        {flags.length > 1 && !warning ? (
          <Checkbox
            aria-label={t("featureFlags.copyDialog.selectFlag", {
              name: flag.name,
            })}
            className="mt-0.5"
            checked={activeSelectedIds.has(flag.id)}
            disabled={
              !allowed ||
              precheckQuery.isLoading ||
              precheckQuery.isError ||
              mutation.isPending
            }
            onCheckedChange={() => toggleSelection(flag.id, allowed)}
          />
        ) : flags.length > 1 ? (
          <span aria-hidden className="size-4 shrink-0" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{flag.name}</p>
          <code className="mt-1 inline-block max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {flag.key}
          </code>
        </div>
      </div>
    )
  }

  function renderPrecheckResult(flag: FeatureFlag) {
    const result = results.get(flag.id)
    const blocked = Boolean(result && !result.keyCheck)
    const warning = Boolean(result && hasLimitations(result))

    if (!targetEnvId) {
      return (
        <p className="text-xs text-muted-foreground">
          {t("featureFlags.copyDialog.chooseTarget")}
        </p>
      )
    }
    if (precheckQuery.isLoading) {
      return (
        <div className="flex gap-3">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("featureFlags.copyDialog.checking")}
            </p>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-2/3" />
          </div>
        </div>
      )
    }
    if (precheckQuery.isError) {
      return (
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-xs text-destructive">
            <CircleX className="size-4 shrink-0" />
            {t("featureFlags.copyDialog.precheckFailed")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void precheckQuery.refetch()}
          >
            {t("featureFlags.copyDialog.retry")}
          </Button>
        </div>
      )
    }
    if (blocked) {
      return (
        <div className="space-y-2 text-destructive">
          <p className="flex items-center gap-2 text-xs font-medium">
            <CircleX className="text-destructive-foreground size-4 shrink-0 fill-destructive" />
            {t("featureFlags.copyDialog.blocked")}
          </p>
          <p className="pl-6 text-xs leading-5">
            {t("featureFlags.copyDialog.duplicateKey")}
          </p>
        </div>
      )
    }
    if (warning && result) {
      return (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0 fill-amber-500 text-amber-500" />
            {t("featureFlags.copyDialog.limitations")}
          </p>
          <ul className="space-y-2 pl-5 text-xs text-muted-foreground">
            {!result.targetUserCheck ? (
              <li className="list-disc pl-0.5">
                <span className="font-medium text-foreground">
                  {t("featureFlags.copyDialog.usersSkipped")}
                </span>
                <span className="mt-0.5 block">
                  {t("featureFlags.copyDialog.usersScoped")}
                </span>
              </li>
            ) : null}
            {!result.targetRuleCheck ? (
              <li className="list-disc pl-0.5">
                <span className="font-medium text-foreground">
                  {t("featureFlags.copyDialog.rulesSkipped")}
                </span>
                <span className="mt-0.5 block">
                  {t("featureFlags.copyDialog.rulesUnavailable")}
                </span>
              </li>
            ) : null}
            {result.newProperties.length ? (
              <li className="list-disc pl-0.5 text-foreground">
                {t("featureFlags.copyDialog.propertiesAdded")}{" "}
                {result.newProperties.map((property) => (
                  <code
                    key={property}
                    className="mr-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
                  >
                    {property}
                  </code>
                ))}
              </li>
            ) : null}
          </ul>
          <div className="flex items-start gap-2 text-xs">
            <Checkbox
              aria-label={t("featureFlags.copyDialog.includeLimited", {
                name: flag.name,
              })}
              checked={activeSelectedIds.has(flag.id)}
              disabled={mutation.isPending}
              onCheckedChange={(checked) =>
                setWarningIncluded(flag.id, checked === true)
              }
            />
            <button
              type="button"
              className="cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
              disabled={mutation.isPending}
              onClick={() =>
                setWarningIncluded(flag.id, !activeSelectedIds.has(flag.id))
              }
            >
              <span className="font-medium">
                {t("featureFlags.copyDialog.includeLimitedTitle")}
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                {t("featureFlags.copyDialog.includeLimitedHelp")}
              </span>
            </button>
          </div>
        </div>
      )
    }
    if (result) {
      return (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0 fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400" />
            {t("featureFlags.copyDialog.ready")}
          </p>
          <p className="pl-6 text-xs text-muted-foreground">
            {t("featureFlags.copyDialog.readyHelp")}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
    >
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle>{t("featureFlags.copyDialog.title")}</DialogTitle>
          <DialogDescription>
            {lockedTarget
              ? t("featureFlags.copyDialog.lockedDescription")
              : t("featureFlags.copyDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-4">
          <div className="grid shrink-0 grid-cols-[minmax(0,0.92fr)_auto_minmax(0,1.08fr)] grid-rows-[auto_auto] gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5">
            <p className="col-start-1 row-start-1 text-xs leading-4 text-muted-foreground">
              {t("featureFlags.copyDialog.source")}
            </p>
            <p className="col-start-3 row-start-1 text-xs leading-4 text-muted-foreground">
              {t("featureFlags.copyDialog.target")}
            </p>
            <div
              data-testid="copy-source-environment"
              className="col-start-1 row-start-2 flex h-7 min-w-0 items-center gap-2 text-sm font-medium"
            >
              <Box
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="truncate">
                {source?.projectName} / {source?.envName}
              </span>
            </div>
            <ArrowRight className="col-start-2 row-start-2 size-5 self-center text-muted-foreground" />
            <div
              data-testid="copy-target-environment"
              className="col-start-3 row-start-2 min-w-0"
            >
              {lockedTarget ? (
                <div className="flex h-7 min-w-0 items-center gap-2 text-sm font-medium">
                  <Box
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{lockedTarget.name}</span>
                  <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={selectedTargetEnvId}
                  onValueChange={(value) => {
                    setSelectedTargetEnvId(value ?? "")
                    resetSelection()
                  }}
                  disabled={mutation.isPending}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent"
                  >
                    <SelectValue>
                      {selectedTarget ? (
                        <span className="flex min-w-0 items-center gap-2 font-medium">
                          <Box
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                          <span className="truncate">
                            {selectedTarget.name}
                          </span>
                        </span>
                      ) : (
                        t("featureFlags.copyDialog.selectEnvironment")
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {targetProjects.map((project) => (
                      <SelectGroup key={project.id}>
                        <SelectLabel>{project.name}</SelectLabel>
                        {project.environments.map((environment) => (
                          <SelectItem
                            key={environment.id}
                            value={environment.id}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Box
                                aria-hidden
                                className="size-4 shrink-0 text-muted-foreground"
                              />
                              <span className="truncate">
                                {project.name} / {environment.name}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div
            data-testid="copy-flags-scroll-area"
            className="min-h-0 flex-1 overflow-y-auto rounded-lg border"
          >
            {copyUnavailable ? (
              <div className="grid sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="min-w-0">
                  {flags.map((flag) => (
                    <div key={flag.id} className="border-b last:border-b-0">
                      {renderFlagIdentity(flag)}
                    </div>
                  ))}
                </div>
                <div className="flex min-h-36 items-center border-t px-5 py-4 sm:border-t-0 sm:border-l">
                  <div className="flex gap-4">
                    <ShieldAlert className="size-9 shrink-0 text-primary" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {t("featureFlags.copyDialog.unavailable")}
                      </p>
                      <p className="max-w-64 text-xs leading-5 text-muted-foreground">
                        {t("featureFlags.copyDialog.unavailableHelp")}
                      </p>
                      <Link
                        to={localizedPath(lang, licenseHref)}
                        className="inline-block text-xs font-medium text-primary hover:underline"
                      >
                        {t("featureFlags.copyDialog.learnMore")}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              flags.map((flag) => (
                <div
                  key={flag.id}
                  className="grid border-b last:border-b-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                >
                  {renderFlagIdentity(flag)}
                  <div className="min-w-0 border-t px-3 py-3 sm:border-t-0 sm:border-l">
                    {renderPrecheckResult(flag)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="m-0 rounded-none border-t-0 bg-transparent px-5 py-4">
          <span className="mr-auto self-center text-sm">
            {t("featureFlags.copyDialog.selected", {
              selected: selectedCount,
              total: flags.length,
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("featureFlags.copyDialog.cancel")}
          </Button>
          <Button
            type="button"
            disabled={
              !targetEnvId ||
              precheckQuery.isLoading ||
              precheckQuery.isError ||
              !selectedCount ||
              mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("featureFlags.copyDialog.copy", { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
