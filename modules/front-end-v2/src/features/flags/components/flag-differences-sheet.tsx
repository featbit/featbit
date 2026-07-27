import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Box,
  Check,
  Copy,
  Loader2,
  Lock,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fetchProjects,
  getCurrentProjectEnv,
} from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import { compareFeatureFlag, copyFeatureFlagSettings } from "../flags-api"
import type {
  FeatureFlag,
  FlagComparisonDetail,
  FlagSettingCopyMode,
  FlagSettingCopyOptions,
} from "../flags-types"
import {
  FlagDifferenceValue,
  type FlagDifferenceKey,
} from "./flag-difference-value"

export type FlagDifferenceTarget = {
  id: string
  name: string
}

type Props = {
  lang: Lang
  envId: string
  flag: Pick<FeatureFlag, "name" | "key"> | null
  open: boolean
  lockedTarget?: FlagDifferenceTarget | null
  comparisonGranted?: boolean
  canCopy?: boolean
  onOpenChange: (open: boolean) => void
  onCopied?: () => void
}

type RowDefinition = {
  key: FlagDifferenceKey
  different: (detail: FlagComparisonDetail) => boolean
  copyable: (detail: FlagComparisonDetail) => boolean
  supportsMode?: boolean
}

const rows: RowDefinition[] = [
  {
    key: "onOffState",
    different: (detail) => detail.diff.onOffState.isDifferent,
    copyable: () => true,
  },
  {
    key: "individualTargeting",
    different: (detail) =>
      detail.diff.individualTargeting.some((item) => item.isDifferent),
    copyable: () => true,
    supportsMode: true,
  },
  {
    key: "targetingRule",
    different: (detail) =>
      detail.diff.targetingRule.some((item) => item.isDifferent),
    copyable: (detail) => detail.isRulesCopyable,
    supportsMode: true,
  },
  {
    key: "defaultRule",
    different: (detail) => detail.diff.defaultRule.isDifferent,
    copyable: () => true,
  },
  {
    key: "offVariation",
    different: (detail) => detail.diff.offVariation.isDifferent,
    copyable: () => true,
  },
]

function getCopyOptions(
  selected: Set<FlagDifferenceKey>,
  modes: Record<"individualTargeting" | "targetingRule", FlagSettingCopyMode>
): FlagSettingCopyOptions {
  return {
    onOffState: selected.has("onOffState"),
    individualTargeting: {
      copy: selected.has("individualTargeting"),
      mode: modes.individualTargeting,
    },
    targetingRule: {
      copy: selected.has("targetingRule"),
      mode: modes.targetingRule,
    },
    defaultRule: selected.has("defaultRule"),
    offVariation: selected.has("offVariation"),
  }
}

export function FlagDifferencesSheet({
  lang,
  envId,
  flag,
  open,
  lockedTarget = null,
  comparisonGranted = true,
  canCopy = true,
  onOpenChange,
  onCopied,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const source = getCurrentProjectEnv()
  const [selectedTargetId, setSelectedTargetId] = useState("")
  const [selected, setSelected] = useState<Set<FlagDifferenceKey>>(new Set())
  const [modes, setModes] = useState<
    Record<"individualTargeting" | "targetingRule", FlagSettingCopyMode>
  >({ individualTargeting: "overwrite", targetingRule: "overwrite" })
  const targetId = lockedTarget?.id ?? selectedTargetId

  const projectsQuery = useQuery({
    queryKey: ["projects", "flag-differences"],
    queryFn: fetchProjects,
    enabled: open && !lockedTarget,
    staleTime: 5 * 60_000,
  })
  const targetProjects = useMemo(
    () =>
      (projectsQuery.data ?? [])
        .map((project) => ({
          ...project,
          environments: project.environments.filter(
            (environment) => environment.id !== envId
          ),
        }))
        .filter((project) => project.environments.length),
    [envId, projectsQuery.data]
  )
  const selectedTarget = (() => {
    if (lockedTarget) return lockedTarget
    for (const project of targetProjects) {
      const environment = project.environments.find(
        (candidate) => candidate.id === selectedTargetId
      )
      if (environment)
        return {
          id: environment.id,
          name: `${project.name} / ${environment.name}`,
        }
    }
    return null
  })()

  const comparisonQuery = useQuery({
    queryKey: ["feature-flag-difference", envId, targetId, flag?.key ?? ""],
    queryFn: () => compareFeatureFlag(envId, targetId, flag!.key),
    enabled:
      open && comparisonGranted && Boolean(envId && targetId && flag?.key),
    retry: false,
  })
  const detail = comparisonQuery.data ?? null
  const eligibleKeys = useMemo(
    () =>
      new Set(
        detail
          ? rows
              .filter((row) => row.different(detail) && row.copyable(detail))
              .map((row) => row.key)
          : []
      ),
    [detail]
  )
  const allSelected =
    eligibleKeys.size > 0 && [...eligibleKeys].every((key) => selected.has(key))
  const someSelected =
    [...eligibleKeys].some((key) => selected.has(key)) && !allSelected

  function resetComparisonState() {
    setSelected(new Set())
    setModes({ individualTargeting: "overwrite", targetingRule: "overwrite" })
  }

  function changeOpen(next: boolean) {
    if (copyMutation.isPending) return
    if (!next) {
      resetComparisonState()
      if (!lockedTarget) setSelectedTargetId("")
    }
    onOpenChange(next)
  }

  const copyMutation = useMutation({
    mutationFn: () =>
      copyFeatureFlagSettings(
        envId,
        targetId,
        flag!.key,
        getCopyOptions(selected, modes)
      ),
    onSuccess: () => {
      toast.success(t("featureFlags.differencesSheet.copied"))
      void queryClient.invalidateQueries({
        queryKey: ["feature-flag-difference"],
      })
      onCopied?.()
      resetComparisonState()
      if (!lockedTarget) setSelectedTargetId("")
      onOpenChange(false)
    },
    onError: () => toast.error(t("featureFlags.differencesSheet.copyFailed")),
  })
  const selectAllDisabled = !eligibleKeys.size || copyMutation.isPending

  function toggleRow(key: FlagDifferenceKey) {
    if (!eligibleKeys.has(key) || copyMutation.isPending) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (copyMutation.isPending || !eligibleKeys.size) return
    setSelected(allSelected ? new Set() : new Set(eligibleKeys))
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent
        className="!w-[calc(100vw-2rem)] !max-w-none gap-0 sm:!max-w-[min(1000px,calc(100vw-3rem))]"
        showCloseButton={!copyMutation.isPending}
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 sm:px-8">
          <SheetTitle className="text-lg font-semibold">
            {t("featureFlags.differencesSheet.compare", {
              name: flag?.name ?? "-",
            })}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">
              {flag?.key ?? "-"}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("featureFlags.differencesSheet.copyKey")}
              disabled={!flag?.key}
              onClick={async () => {
                if (!flag?.key) return
                try {
                  await navigator.clipboard.writeText(flag.key)
                  toast.success(t("featureFlags.differencesSheet.keyCopied"))
                } catch {
                  toast.error(t("featureFlags.differencesSheet.keyCopyFailed"))
                }
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 px-5 py-4 sm:px-8">
            <div className="min-w-0">
              <p className="mb-1.5 text-xs text-muted-foreground">
                {t("featureFlags.differencesSheet.source")}
              </p>
              <div
                data-testid="flag-difference-source"
                className="flex h-8 min-w-0 items-center gap-2 rounded-md border bg-muted/40 px-3"
              >
                <Box className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">
                  {source ? `${source.projectName} / ${source.envName}` : "-"}
                </span>
                <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              </div>
            </div>
            <ArrowRight className="mb-2.5 size-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="mb-1.5 text-xs text-muted-foreground">
                {t("featureFlags.differencesSheet.target")}
              </p>
              {lockedTarget ? (
                <div className="flex h-8 min-w-0 items-center gap-2 rounded-md border bg-muted/40 px-3">
                  <Box className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{lockedTarget.name}</span>
                  <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={selectedTargetId}
                  disabled={copyMutation.isPending}
                  onValueChange={(value) => {
                    resetComparisonState()
                    setSelectedTargetId(value ?? "")
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedTarget ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Box className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {selectedTarget.name}
                          </span>
                        </span>
                      ) : (
                        t("featureFlags.differencesSheet.selectTarget")
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
                            <Box className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {project.name} / {environment.name}
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
          {!comparisonGranted ? (
            <div className="m-8 rounded-md bg-muted/50 p-5">
              <p className="font-medium">
                {t("featureFlags.differencesSheet.unavailable")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("featureFlags.differencesSheet.unavailableHelp")}
              </p>
            </div>
          ) : !selectedTarget ? (
            <div className="flex min-h-64 items-center justify-center p-8 text-center text-sm text-muted-foreground">
              {t("featureFlags.differencesSheet.selectTargetHelp")}
            </div>
          ) : comparisonQuery.isLoading ? (
            <div className="space-y-3 p-8">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : comparisonQuery.isError ? (
            <div className="m-8 flex items-center justify-between gap-4 rounded-md bg-destructive/5 p-4 text-sm text-destructive">
              <span>{t("featureFlags.differencesSheet.loadFailed")}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void comparisonQuery.refetch()}
              >
                {t("featureFlags.differencesSheet.retry")}
              </Button>
            </div>
          ) : !detail ? (
            <div className="flex min-h-64 items-center justify-center p-8 text-center">
              <div>
                <p className="font-medium">
                  {t("featureFlags.differencesSheet.missingTarget")}
                </p>
                <p
                  data-testid="missing-target-environment"
                  className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground"
                >
                  <Box className="size-3.5 shrink-0" />
                  <span>{selectedTarget.name}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[220px_minmax(280px,1fr)_minmax(280px,1fr)] border-b bg-muted/30 text-xs font-medium">
                <div className="flex items-center gap-3 px-5 py-3">
                  <Checkbox
                    aria-label={t("featureFlags.differencesSheet.selectAll")}
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={selectAllDisabled}
                    onCheckedChange={toggleAll}
                  />
                  {t("featureFlags.differencesSheet.selectAll")}
                </div>
                <div
                  data-testid="source-settings-heading"
                  className="flex min-w-0 items-center gap-2 px-5 py-3"
                >
                  <span className="shrink-0 font-normal text-muted-foreground">
                    {t("featureFlags.differencesSheet.settingsIn")}
                  </span>
                  <span className="flex min-w-0 items-center gap-1">
                    <Box className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-semibold text-foreground">
                      {source?.projectName} / {source?.envName}
                    </span>
                  </span>
                </div>
                <div
                  data-testid="target-settings-heading"
                  className="flex min-w-0 items-center gap-2 px-5 py-3"
                >
                  <span className="shrink-0 font-normal text-muted-foreground">
                    {t("featureFlags.differencesSheet.settingsIn")}
                  </span>
                  <span className="flex min-w-0 items-center gap-1">
                    <Box className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-semibold text-foreground">
                      {selectedTarget.name}
                    </span>
                  </span>
                </div>
              </div>
              {rows.map((row) => {
                const different = row.different(detail)
                const copyable = row.copyable(detail)
                const rowSelected = selected.has(row.key)
                const mode =
                  row.key === "individualTargeting" ||
                  row.key === "targetingRule"
                    ? modes[row.key]
                    : "overwrite"
                const rowDisabled =
                  !different || !copyable || copyMutation.isPending
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "grid grid-cols-[220px_minmax(280px,1fr)_minmax(280px,1fr)] border-b",
                      rowSelected && "bg-primary/[0.035]"
                    )}
                  >
                    <div className="px-5 py-5">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          aria-label={t(
                            `featureFlags.differencesSheet.rows.${row.key}`
                          )}
                          checked={rowSelected}
                          disabled={rowDisabled}
                          onCheckedChange={() => toggleRow(row.key)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {t(`featureFlags.differencesSheet.rows.${row.key}`)}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-xs",
                              different
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {different
                              ? t("featureFlags.differencesSheet.different")
                              : t("featureFlags.differencesSheet.noDifference")}
                          </p>
                        </div>
                      </div>
                      {rowSelected && row.supportsMode ? (
                        <RadioGroup
                          className="mt-4 gap-2 pl-7"
                          value={mode}
                          onValueChange={(value) =>
                            setModes((current) => ({
                              ...current,
                              [row.key]: value as FlagSettingCopyMode,
                            }))
                          }
                        >
                          {(["overwrite", "append"] as const).map((value) => (
                            <label
                              key={value}
                              className="flex cursor-pointer items-center gap-2 text-xs"
                            >
                              <RadioGroupItem value={value} />
                              {t(
                                `featureFlags.differencesSheet.${
                                  value === "overwrite" ? "overwrite" : "append"
                                }${row.key === "targetingRule" ? "Rules" : "Users"}`
                              )}
                            </label>
                          ))}
                        </RadioGroup>
                      ) : null}
                    </div>
                    {!copyable && row.key === "targetingRule" ? (
                      <div className="col-span-2 flex gap-2 px-5 py-5 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>
                          {t("featureFlags.differencesSheet.rulesNotCopyable")}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="px-5 py-5">
                          <FlagDifferenceValue
                            flag={detail.source}
                            setting={row.key}
                            lang={lang}
                            tooltipUserStyle="added"
                          />
                        </div>
                        <div className="px-5 py-5">
                          <FlagDifferenceValue
                            flag={detail.target}
                            setting={row.key}
                            lang={lang}
                            tooltipUserStyle="existing"
                          />
                          {rowSelected ? (
                            <div className="mt-4">
                              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                                <ArrowDown className="size-3.5" />
                                {t("featureFlags.differencesSheet.afterCopy")}
                                {row.supportsMode
                                  ? ` · ${
                                      mode === "append"
                                        ? t(
                                            "featureFlags.differencesSheet.targetKept"
                                          )
                                        : t(
                                            "featureFlags.differencesSheet.targetReplaced"
                                          )
                                    }`
                                  : ""}
                              </p>
                              <div className="rounded-md bg-primary/5 px-3 py-3">
                                <FlagDifferenceValue
                                  flag={detail.target}
                                  source={detail.source}
                                  setting={row.key}
                                  previewMode={mode}
                                  lang={lang}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 flex-row items-center justify-between bg-transparent px-5 py-4 sm:px-8">
          <p className="text-sm text-muted-foreground">
            {selected.size
              ? t("featureFlags.differencesSheet.selected", {
                  count: selected.size,
                })
              : t("featureFlags.differencesSheet.noneSelected")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={copyMutation.isPending}
              onClick={() => changeOpen(false)}
            >
              {t("featureFlags.differencesSheet.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                !canCopy || !detail || !selected.size || copyMutation.isPending
              }
              onClick={() => copyMutation.mutate()}
            >
              {copyMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              {copyMutation.isPending
                ? t("featureFlags.differencesSheet.copying")
                : t("featureFlags.differencesSheet.copySettings")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
