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
import { useTranslation } from "react-i18next"
import type {
  CompareEnvironment,
  FlagCompareOverview,
  FlagDiffOverview,
} from "../flags-compare-types"

type DifferenceCategory = {
  key: keyof Omit<FlagDiffOverview, "targetEnvId">
}

const differenceCategories: DifferenceCategory[] = [
  { key: "onOffState" },
  { key: "individualTargeting" },
  { key: "targetingRule" },
  { key: "defaultRule" },
  { key: "offVariation" },
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
  const { t } = useTranslation()
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
        aria-label={t("featureFlags.comparePage.matrix.openDetails", {
          name: flag.name,
        })}
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
                aria-label={t("featureFlags.comparePage.matrix.copyFlagKey", {
                  key: flag.key,
                })}
                onClick={() => onCopyKey(flag.key)}
              />
            }
          >
            <Copy />
          </TooltipTrigger>
          <TooltipContent>
            {t("featureFlags.comparePage.matrix.copyKey")}
          </TooltipContent>
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
                    aria-label={t(
                      "featureFlags.comparePage.matrix.showAllTags"
                    )}
                  />
                }
              >
                +{flag.tags.length - visibleTags.length}
              </TooltipTrigger>
              <TooltipContent className="max-w-80 flex-col items-start gap-1 whitespace-normal">
                <span className="font-medium">
                  {t("featureFlags.comparePage.matrix.allTags")}
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
  const { t } = useTranslation()
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
      aria-label={t("featureFlags.comparePage.matrix.openTargetLabel", {
        name: flag.name,
        environment: target.label,
      })}
    >
      <span className="leading-4">
        {t("featureFlags.comparePage.matrix.openTarget")}
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
  const { t } = useTranslation()
  const diff = flag.diffs.find((item) => item.targetEnvId === target.id)

  if (!diff) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Info className="size-4 shrink-0 text-muted-foreground" />
          <Badge variant="secondary" className="font-normal">
            {t("featureFlags.comparePage.matrix.flagNotFound")}
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
                {t("featureFlags.comparePage.matrix.copyHere")}
              </span>
            </Button>
          </TooltipTrigger>
          {!canCopy ? (
            <TooltipContent>
              {permissionPending
                ? t("featureFlags.comparePage.matrix.checkingPermissions")
                : t("featureFlags.comparePage.matrix.copyDenied")}
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
          <span>{t("featureFlags.comparePage.matrix.noDifferences")}</span>
        </div>
        <TargetFlagLink flag={flag} target={target} lang={lang} />
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
        <AlertTriangle className="size-4 shrink-0 fill-amber-500 text-amber-500" />
        {t("featureFlags.comparePage.matrix.differenceCount", {
          count: differences.length,
        })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {differences.map((category) => (
          <Badge key={category.key} variant="outline" className="font-normal">
            {t(`featureFlags.comparePage.matrix.categories.${category.key}`)}
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
            {t("featureFlags.comparePage.matrix.reviewDifferences")}
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
  const { t } = useTranslation()
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
              {t("featureFlags.comparePage.matrix.featureFlag")}
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
                      ? t("featureFlags.comparePage.matrix.filteredEmpty")
                      : t("featureFlags.comparePage.matrix.sourceEmpty")}
                  </p>
                  {hasFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClearFilters}
                    >
                      {t("featureFlags.comparePage.matrix.clearFilters")}
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
