import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizedProjectEnvPath } from "@/features/layout/layout-context"
import type { Lang, ProjectEnv } from "@/features/layout/layout-types"
import { Link } from "react-router-dom"
import type {
  CompareEnvironment,
  FlagCompareOverview,
  FlagDiffOverview,
} from "../flags-compare-types"

type DifferenceCategory = {
  key: keyof Omit<FlagDiffOverview, "targetEnvId">
  en: string
  zh: string
}

const differenceCategories: DifferenceCategory[] = [
  { key: "onOffState", en: "On/OFF state", zh: "开关状态" },
  {
    key: "individualTargeting",
    en: "Individual targeting",
    zh: "单独定向",
  },
  { key: "targetingRule", en: "Targeting rules", zh: "定向规则" },
  { key: "defaultRule", en: "Default rule", zh: "默认规则" },
  { key: "offVariation", en: "Off variation", zh: "关闭变体" },
]

function FlagIdentity({
  flag,
  lang,
  source,
  onCopyKey,
}: {
  flag: FlagCompareOverview
  lang: Lang
  source: Pick<ProjectEnv, "projectId" | "envId">
  onCopyKey: (key: string) => void
}) {
  const zh = lang === "zh"
  const visibleTags = flag.tags.slice(0, 2)

  return (
    <div className="min-w-0 space-y-2">
      <Link
        to={localizedProjectEnvPath(
          lang,
          `/feature-flags/${encodeURIComponent(flag.key)}/targeting`,
          source
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="block truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        title={flag.name}
        aria-label={`${flag.name} (${zh ? "在新标签页打开详情" : "open details in a new tab"})`}
      >
        {flag.name}
      </Link>
      <div className="flex min-w-0 items-center gap-1">
        <code
          className="min-w-0 truncate rounded bg-muted px-2 py-0.5 text-xs text-foreground"
          title={flag.key}
        >
          {flag.key}
        </code>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${zh ? "复制功能开关键" : "Copy feature flag key"} ${flag.key}`}
                onClick={() => onCopyKey(flag.key)}
              />
            }
          >
            <Copy />
          </TooltipTrigger>
          <TooltipContent>{zh ? "复制键" : "Copy key"}</TooltipContent>
        </Tooltip>
      </div>
      {flag.tags.length ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="max-w-28 font-normal"
            >
              <span className="truncate" title={tag}>
                {tag}
              </span>
            </Badge>
          ))}
          {flag.tags.length > visibleTags.length ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge
                    variant="outline"
                    className="cursor-help font-normal"
                    tabIndex={0}
                    aria-label={zh ? "显示所有标签" : "Show all tags"}
                  />
                }
              >
                +{flag.tags.length - visibleTags.length}
              </TooltipTrigger>
              <TooltipContent className="max-w-80 flex-col items-start gap-1 whitespace-normal">
                <span className="font-medium">
                  {zh ? "所有标签" : "All tags"}
                </span>
                <span className="break-words">{flag.tags.join(", ")}</span>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function TargetFlagLink({
  flag,
  target,
  lang,
}: {
  flag: FlagCompareOverview
  target: CompareEnvironment
  lang: Lang
}) {
  const zh = lang === "zh"
  const href = localizedProjectEnvPath(
    lang,
    `/feature-flags/${encodeURIComponent(flag.key)}/targeting`,
    { projectId: target.projectId, envId: target.id }
  )

  return (
    <Link
      to={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({
        variant: "link",
        size: "sm",
        className: "font-medium",
      })}
      aria-label={
        zh
          ? `在新标签页中打开 ${target.label} 的 ${flag.name}`
          : `Open ${flag.name} in ${target.label} in a new tab`
      }
    >
      <span className="leading-4">
        {zh ? "在此环境中打开开关" : "Open flag in this environment"}
      </span>
      <ExternalLink
        data-icon="inline-end"
        className="size-3.5 -translate-y-px"
      />
    </Link>
  )
}

function DifferenceCell({
  flag,
  target,
  lang,
  canCopy,
  permissionPending,
  onReview,
  onCopy,
}: {
  flag: FlagCompareOverview
  target: CompareEnvironment
  lang: Lang
  canCopy: boolean
  permissionPending: boolean
  onReview: () => void
  onCopy: () => void
}) {
  const zh = lang === "zh"
  const diff = flag.diffs.find((item) => item.targetEnvId === target.id)

  if (!diff) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Info className="size-4 shrink-0 text-muted-foreground" />
          <Badge variant="secondary" className="font-normal">
            {zh ? "未找到功能开关" : "Flag not found"}
          </Badge>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex" tabIndex={!canCopy ? 0 : -1} />
            }
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="font-medium"
              disabled={!canCopy}
              onClick={onCopy}
            >
              <Copy />
              <span className="translate-y-px">
                {zh ? "复制功能开关到这里" : "Copy flag here"}
              </span>
            </Button>
          </TooltipTrigger>
          {!canCopy ? (
            <TooltipContent>
              {permissionPending
                ? zh
                  ? "正在检查权限…"
                  : "Checking permissions…"
                : zh
                  ? "你没有复制此功能开关的权限。"
                  : "You do not have permission to copy this flag."}
            </TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    )
  }

  const differences = differenceCategories.filter(
    (category) => diff[category.key]
  )
  if (!differences.length) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{zh ? "无差异" : "No differences"}</span>
        </div>
        <TargetFlagLink flag={flag} target={target} lang={lang} />
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
        <AlertTriangle className="size-4 shrink-0 fill-amber-500 text-amber-500" />
        {zh
          ? `${differences.length} 处差异`
          : `${differences.length} ${differences.length === 1 ? "difference" : "differences"}`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {differences.map((category) => (
          <Badge key={category.key} variant="outline" className="font-normal">
            {zh ? category.zh : category.en}
          </Badge>
        ))}
      </div>
      <div className="flex flex-col items-start gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="font-medium"
          onClick={onReview}
        >
          <span className="translate-y-px">
            {zh ? "查看差异" : "Review differences"}
          </span>
          <ChevronRight />
        </Button>
        <TargetFlagLink flag={flag} target={target} lang={lang} />
      </div>
    </div>
  )
}

export function FlagsCompareMatrix({
  lang,
  source,
  items,
  targets,
  loading,
  hasFilters,
  permissionPending,
  canCopy,
  onReview,
  onCopy,
  onCopyKey,
  onClearFilters,
}: {
  lang: Lang
  source: Pick<ProjectEnv, "projectId" | "envId">
  items: FlagCompareOverview[]
  targets: CompareEnvironment[]
  loading: boolean
  hasFilters: boolean
  permissionPending: boolean
  canCopy: (flag: FlagCompareOverview) => boolean
  onReview: (flag: FlagCompareOverview, target: CompareEnvironment) => void
  onCopy: (flag: FlagCompareOverview, target: CompareEnvironment) => void
  onCopyKey: (key: string) => void
  onClearFilters: () => void
}) {
  const zh = lang === "zh"
  const columnCount = targets.length + 1
  const minWidth = 280 + targets.length * 300

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <Table className="table-fixed" style={{ minWidth }}>
        <colgroup>
          <col style={{ width: 280 }} />
          {targets.map((target) => (
            <col key={target.id} style={{ width: 300 }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-20 h-11 bg-muted/30 px-4">
              {zh ? "功能开关" : "Feature flag"}
            </TableHead>
            {targets.map((target) => (
              <TableHead key={target.id} className="h-11 bg-muted/30 px-4">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="flex max-w-64 items-center gap-2 font-medium" />
                    }
                  >
                    <Box className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{target.label}</span>
                  </TooltipTrigger>
                  <TooltipContent>{target.label}</TooltipContent>
                </Tooltip>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 4 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-transparent">
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className={
                        cellIndex === 0
                          ? "sticky left-0 z-10 bg-background px-4 py-5"
                          : "px-4 py-5"
                      }
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}

          {!loading && !items.length ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="h-52 text-center">
                <div className="mx-auto max-w-md space-y-3 whitespace-normal">
                  <p className="text-sm text-muted-foreground">
                    {hasFilters
                      ? zh
                        ? "没有功能开关匹配当前筛选条件。"
                        : "No feature flags match the current filters."
                      : zh
                        ? "当前源环境中没有功能开关。"
                        : "No feature flags are available in the source environment."}
                  </p>
                  {hasFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClearFilters}
                    >
                      {zh ? "清除筛选" : "Clear filters"}
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : null}

          {!loading
            ? items.map((flag) => (
                <TableRow key={flag.id} className="hover:bg-transparent">
                  <TableCell className="sticky left-0 z-10 bg-background px-4 py-5 align-top whitespace-normal">
                    <FlagIdentity
                      flag={flag}
                      lang={lang}
                      source={source}
                      onCopyKey={onCopyKey}
                    />
                  </TableCell>
                  {targets.map((target) => (
                    <TableCell
                      key={target.id}
                      className="px-4 py-5 align-top whitespace-normal"
                    >
                      <DifferenceCell
                        flag={flag}
                        target={target}
                        lang={lang}
                        canCopy={canCopy(flag)}
                        permissionPending={permissionPending}
                        onReview={() => onReview(flag, target)}
                        onCopy={() => onCopy(flag, target)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>
    </div>
  )
}
