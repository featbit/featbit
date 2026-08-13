import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  Search,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  resourceDisplayName,
  type ResourceType,
} from "@/features/iam/policies/details/permission-model"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { TFunction } from "i18next"
import type { MemberPermission } from "../permissions-api"
import {
  isAllResourceScope,
  matchesPermissionQuery,
  permissionActionFallback,
} from "../permissions-model"
import { PermissionDiagnosticsSheet } from "./permission-diagnostics-sheet"
import { PermissionStatementDetails } from "./permission-statement-details"

export function PermissionsTab({
  memberId,
  lang,
  items,
  loading,
  error,
  onRetry,
}: {
  memberId: string
  lang: Lang
  items: MemberPermission[]
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [expandedPermissionKey, setExpandedPermissionKey] = useState<
    string | null
  >(null)

  const filteredItems = useMemo(
    () =>
      items.filter((permission) =>
        matchesPermissionQuery(permission, search, [
          resourceTypeLabel(permission.resourceType, t),
          ...permission.resources.map(resourceDisplayName),
          ...permission.actions.map((action) => actionLabel(action, t)),
          permission.effect === "allow"
            ? t("iam.team.details.allow")
            : t("iam.team.details.deny"),
        ])
      ),
    [items, search, t]
  )

  return (
    <>
      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {t("iam.team.details.assignedPermissions")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("iam.team.details.assignedPermissionsDescription")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={t("iam.team.details.filterPermissions")}
              aria-label={t("iam.team.details.searchPermissions")}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => setDiagnosticsOpen(true)}>
            <ShieldCheck className="size-4" />
            {t("iam.team.details.checkAccess")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-3 flex items-center justify-between gap-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t("iam.team.details.permissionLoadFailed")}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onRetry}
          >
            {t("iam.team.details.retry")}
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <Table className="min-w-[960px] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[5%] px-1 py-3">
                <span className="sr-only">
                  {t("iam.team.details.permissionDetails")}
                </span>
              </TableHead>
              <TableHead className="w-[11%] px-5 py-3 font-semibold">
                {t("iam.team.details.effect")}
              </TableHead>
              <TableHead className="w-[28%] px-5 py-3 font-semibold">
                {t("iam.team.details.resourceScope")}
              </TableHead>
              <TableHead className="w-[30%] px-5 py-3 font-semibold">
                {t("iam.team.details.actions")}
              </TableHead>
              <TableHead className="w-[26%] px-5 py-3 font-semibold">
                {t("iam.team.details.grantedThrough")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell className="px-1 py-4">
                    <Skeleton className="mx-auto size-7 rounded-md" />
                  </TableCell>
                  <TableCell className="px-5 py-4">
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </TableCell>
                  <TableCell className="space-y-2 px-5 py-4">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-56" />
                  </TableCell>
                  <TableCell className="space-y-2 px-5 py-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </TableCell>
                  <TableCell className="space-y-2 px-5 py-4">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-44" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredItems.length ? (
              filteredItems.map((permission) => {
                const rowKey = permissionRowKey(permission)
                const expanded = expandedPermissionKey === rowKey

                return (
                  <PermissionRow
                    key={rowKey}
                    permission={permission}
                    lang={lang}
                    t={t}
                    expanded={expanded}
                    onToggle={() =>
                      setExpandedPermissionKey(expanded ? null : rowKey)
                    }
                  />
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-40 px-5 text-center">
                  <div className="mx-auto max-w-sm whitespace-normal">
                    <p className="text-sm font-medium">
                      {search
                        ? t("iam.team.details.noPermissionResults")
                        : t("iam.team.details.permissionRulesEmpty")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {search
                        ? t("iam.team.details.tryAnotherPermissionSearch")
                        : t("iam.team.details.permissionRulesEmptyDescription")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PermissionDiagnosticsSheet
        memberId={memberId}
        lang={lang}
        open={diagnosticsOpen}
        onOpenChange={setDiagnosticsOpen}
      />
    </>
  )
}

function PermissionRow({
  permission,
  lang,
  t,
  expanded,
  onToggle,
}: {
  permission: MemberPermission
  lang: Lang
  t: TFunction
  expanded: boolean
  onToggle: () => void
}) {
  const allResources = isAllResourceScope(
    permission.resourceType,
    permission.resources
  )
  const resourceNames = permission.resources.map(resourceDisplayName)
  const actionNames = permission.actions.map((action) => actionLabel(action, t))
  const allActions = permission.actions.includes("*")
  const resourceType = resourceTypeLabel(permission.resourceType, t)
  const pluralType = t(
    `iam.policies.details.permissionsEditor.resourceTypePlurals.${permission.resourceType}`,
    { defaultValue: resourceType.toLocaleLowerCase() }
  )
  const selectedResourceType =
    permission.resources.length === 1
      ? resourceType.toLocaleLowerCase()
      : pluralType
  const statementSearch = new URLSearchParams({
    statementId: permission.statementId,
    focusStatementId: permission.statementId,
  })
  const policyUrl = `${localizedPath(
    lang,
    `/iam/policies/${encodeURIComponent(permission.policyId)}/permission`
  )}?${statementSearch.toString()}`
  const detailsId = permissionDetailsId(permission)

  return (
    <>
      <TableRow
        aria-expanded={expanded}
        className={
          expanded
            ? "border-b-0 bg-muted/30 hover:bg-muted/30 has-aria-expanded:bg-muted/30"
            : undefined
        }
      >
        <TableCell className="px-1 py-2 align-middle">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mx-auto size-11 shrink-0"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={t(
              expanded
                ? "iam.team.details.collapsePermission"
                : "iam.team.details.expandPermission",
              { policy: permission.policyName }
            )}
            onClick={onToggle}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="px-5 py-4 align-top">
          <Badge
            variant="outline"
            className={
              permission.effect === "allow"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            }
          >
            {permission.effect === "allow"
              ? t("iam.team.details.allow")
              : t("iam.team.details.deny")}
          </Badge>
        </TableCell>
        <TableCell className="px-5 py-4 align-top whitespace-normal">
          <SummaryCell
            title={
              allResources
                ? t("iam.team.details.allResourcesByType", {
                    type: resourceType,
                  })
                : t("iam.team.details.resourcesSelected", {
                    count: permission.resources.length,
                    type: selectedResourceType,
                  })
            }
            values={allResources ? [] : resourceNames}
            rawValues={
              allResources ? permission.resources : permission.resources
            }
            visibleCount={2}
          />
        </TableCell>
        <TableCell className="px-5 py-4 align-top whitespace-normal">
          <SummaryCell
            title={
              allActions
                ? t("iam.team.details.allActions")
                : t("iam.team.details.actionsSelected", {
                    count: permission.actions.length,
                  })
            }
            values={allActions ? [] : actionNames}
            rawValues={actionNames}
            visibleCount={3}
          />
        </TableCell>
        <TableCell className="px-5 py-4 align-top whitespace-normal">
          <Link
            to={policyUrl}
            className="line-clamp-2 rounded-sm text-sm font-semibold [overflow-wrap:anywhere] text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
          >
            {permission.policyName}
          </Link>
          <SourceSummary sources={permission.sources} t={t} />
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="p-0 whitespace-normal">
            <PermissionStatementDetails
              id={detailsId}
              permission={permission}
              t={t}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function permissionRowKey(permission: MemberPermission) {
  return `${permission.policyId}:${permission.statementId}`
}

function permissionDetailsId(permission: MemberPermission) {
  return `team-permission-${permissionRowKey(permission).replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

function SummaryCell({
  title,
  values,
  rawValues,
  visibleCount,
}: {
  title: string
  values: string[]
  rawValues: string[]
  visibleCount: number
}) {
  const visible = values.slice(0, visibleCount)
  const overflow = Math.max(0, values.length - visible.length)

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <ListChecks className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-semibold">{title}</span>
      </div>
      {visible.length ? (
        <div className="mt-1 flex min-w-0 items-center gap-1.5 pl-6 text-xs leading-5 text-muted-foreground">
          <TruncatedListTooltip
            text={visible.join(", ")}
            values={rawValues}
            enabled={overflow === 0}
          />
          {overflow ? (
            <OverflowTooltip label={`+${overflow}`} values={rawValues} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SourceSummary({
  sources,
  t,
}: {
  sources: MemberPermission["sources"]
  t: TFunction
}) {
  const labels = sources.map((source) =>
    source.assignmentType === "direct"
      ? t("iam.team.details.directPolicy")
      : t("iam.team.details.viaGroup", {
          name: source.groupName || t("iam.team.details.unknownGroup"),
        })
  )
  const visible = labels.slice(0, 2)
  const overflow = Math.max(0, labels.length - visible.length)

  return (
    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground">
      <TruncatedListTooltip
        text={visible.join(" \u00b7 ")}
        values={labels}
        enabled={overflow === 0}
      />
      {overflow ? (
        <OverflowTooltip
          label={`+${overflow}`}
          heading={t("iam.team.details.assignmentSources")}
          values={labels}
        />
      ) : null}
    </div>
  )
}

function TruncatedListTooltip({
  text,
  values,
  enabled,
}: {
  text: string
  values: string[]
  enabled: boolean
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const measure = () => {
      setTruncated(trigger.scrollWidth > trigger.clientWidth + 1)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(trigger)

    return () => observer.disconnect()
  }, [text])

  const active = enabled && truncated

  return (
    <Tooltip disabled={!active}>
      <TooltipTrigger
        render={
          <span
            ref={triggerRef}
            tabIndex={active ? 0 : undefined}
            className="min-w-0 truncate outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipContent className="max-h-64 max-w-[min(26rem,calc(100vw-2rem))] [scrollbar-width:thin] overflow-y-auto p-3">
        <ul className="space-y-1 text-xs">
          {values.map((value, index) => (
            <li
              key={`${value}:${index}`}
              className="[overflow-wrap:anywhere] break-words"
            >
              {value}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

function OverflowTooltip({
  label,
  heading,
  values,
}: {
  label: string
  heading?: string
  values: string[]
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="secondary"
            className="h-5 shrink-0 rounded-full border border-border px-1.5 font-medium text-foreground"
          />
        }
      >
        {label}
      </TooltipTrigger>
      <TooltipContent className="max-h-64 max-w-[min(26rem,calc(100vw-2rem))] [scrollbar-width:thin] overflow-y-auto p-3">
        {heading ? <p className="mb-1.5 font-medium">{heading}</p> : null}
        <ul className="space-y-1 text-xs">
          {values.map((value, index) => (
            <li
              key={`${value}:${index}`}
              className="[overflow-wrap:anywhere] break-words"
            >
              {value}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

function resourceTypeLabel(resourceType: ResourceType, t: TFunction) {
  return t(
    `iam.policies.details.permissionsEditor.resourceTypes.${resourceType}`,
    { defaultValue: resourceType }
  )
}

function actionLabel(action: string, t: TFunction) {
  return t(`iam.policies.details.permissionsEditor.actionLabels.${action}`, {
    defaultValue: permissionActionFallback(action),
  })
}
