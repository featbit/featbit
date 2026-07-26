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
  en: string
  zh: string
  different: (detail: FlagComparisonDetail) => boolean
  copyable: (detail: FlagComparisonDetail) => boolean
  supportsMode?: boolean
}

const rows: RowDefinition[] = [
  {
    key: "onOffState",
    en: "On/OFF state",
    zh: "开启/关闭状态",
    different: (detail) => detail.diff.onOffState.isDifferent,
    copyable: () => true,
  },
  {
    key: "individualTargeting",
    en: "Individual targeting",
    zh: "单独定向",
    different: (detail) =>
      detail.diff.individualTargeting.some((item) => item.isDifferent),
    copyable: () => true,
    supportsMode: true,
  },
  {
    key: "targetingRule",
    en: "Targeting rules",
    zh: "定向规则",
    different: (detail) =>
      detail.diff.targetingRule.some((item) => item.isDifferent),
    copyable: (detail) => detail.isRulesCopyable,
    supportsMode: true,
  },
  {
    key: "defaultRule",
    en: "Default rule",
    zh: "默认规则",
    different: (detail) => detail.diff.defaultRule.isDifferent,
    copyable: () => true,
  },
  {
    key: "offVariation",
    en: "Off variation",
    zh: "关闭变体",
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
  const zh = lang === "zh"
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
      toast.success(zh ? "设置复制成功。" : "Settings copied successfully.")
      void queryClient.invalidateQueries({
        queryKey: ["feature-flag-difference"],
      })
      onCopied?.()
      resetComparisonState()
      if (!lockedTarget) setSelectedTargetId("")
      onOpenChange(false)
    },
    onError: () =>
      toast.error(zh ? "复制失败，请重试。" : "Copy failed. Please try again."),
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
            {zh ? "比较" : "Compare"} {flag?.name ?? "-"}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">
              {flag?.key ?? "-"}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={zh ? "复制功能开关键" : "Copy feature flag key"}
              disabled={!flag?.key}
              onClick={async () => {
                if (!flag?.key) return
                try {
                  await navigator.clipboard.writeText(flag.key)
                  toast.success(zh ? "已复制 Key。" : "Key copied.")
                } catch {
                  toast.error(
                    zh ? "无法复制 Key。" : "Key could not be copied."
                  )
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
                {zh ? "来源" : "Source"}
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
                {zh ? "目标" : "Target"}
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
                      ) : zh ? (
                        "选择目标环境"
                      ) : (
                        "Select target environment"
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
                {zh
                  ? "功能开关比较不可用"
                  : "Feature flag comparison is unavailable"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {zh
                  ? "当前许可证不包含功能开关比较。"
                  : "Your current license does not include feature flag comparison."}
              </p>
            </div>
          ) : !selectedTarget ? (
            <div className="flex min-h-64 items-center justify-center p-8 text-center text-sm text-muted-foreground">
              {zh
                ? "请选择目标环境以查看差异"
                : "Select a target environment to view differences"}
            </div>
          ) : comparisonQuery.isLoading ? (
            <div className="space-y-3 p-8">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : comparisonQuery.isError ? (
            <div className="m-8 flex items-center justify-between gap-4 rounded-md bg-destructive/5 p-4 text-sm text-destructive">
              <span>
                {zh
                  ? "无法加载比较结果，请重试。"
                  : "Comparison results could not be loaded. Please try again."}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void comparisonQuery.refetch()}
              >
                {zh ? "重试" : "Retry"}
              </Button>
            </div>
          ) : !detail ? (
            <div className="flex min-h-64 items-center justify-center p-8 text-center">
              <div>
                <p className="font-medium">
                  {zh
                    ? "目标环境中不存在此功能开关"
                    : "Flag not found in target environment"}
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
                    aria-label={zh ? "全选" : "Select all"}
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={selectAllDisabled}
                    onCheckedChange={toggleAll}
                  />
                  {zh ? "全选" : "Select all"}
                </div>
                <div
                  data-testid="source-settings-heading"
                  className="flex min-w-0 items-center gap-2 px-5 py-3"
                >
                  <span className="shrink-0 font-normal text-muted-foreground">
                    {zh ? "设置位于" : "Settings in"}
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
                    {zh ? "设置位于" : "Settings in"}
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
                          aria-label={zh ? row.zh : row.en}
                          checked={rowSelected}
                          disabled={rowDisabled}
                          onCheckedChange={() => toggleRow(row.key)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {zh ? row.zh : row.en}
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
                              ? zh
                                ? "有差异"
                                : "Different"
                              : zh
                                ? "无差异"
                                : "No difference"}
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
                              {value === "overwrite"
                                ? zh
                                  ? "覆盖现有内容"
                                  : `Overwrite ${row.key === "targetingRule" ? "rules" : "users"}`
                                : zh
                                  ? "追加到现有内容"
                                  : `Append ${row.key === "targetingRule" ? "rules" : "users"}`}
                            </label>
                          ))}
                        </RadioGroup>
                      ) : null}
                    </div>
                    {!copyable && row.key === "targetingRule" ? (
                      <div className="col-span-2 flex gap-2 px-5 py-5 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>
                          {zh
                            ? "定向规则引用了环境特定或与目标环境不兼容的 Segment，因此无法复制。"
                            : "Targeting rules reference environment-specific or incompatible segments and cannot be copied."}
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
                                {zh ? "复制后" : "After copy"}
                                {row.supportsMode
                                  ? ` · ${mode === "append" ? (zh ? "保留目标内容" : "Existing target content kept") : zh ? "替换目标内容" : "Existing target content replaced"}`
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
              ? zh
                ? `已选择 ${selected.size} 项设置`
                : `${selected.size} settings selected`
              : zh
                ? "未选择设置"
                : "No settings selected"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={copyMutation.isPending}
              onClick={() => changeOpen(false)}
            >
              {zh ? "取消" : "Cancel"}
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
                ? zh
                  ? "复制中…"
                  : "Copying…"
                : zh
                  ? "复制设置"
                  : "Copy settings"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
