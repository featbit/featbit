import { ListChecks, Search, ShieldCheck } from "lucide-react"
import { useMemo, useState } from "react"
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

  const filteredItems = useMemo(
    () =>
      items.filter((permission) =>
        matchesPermissionQuery(permission, search, [
          resourceTypeLabel(permission.resourceType, t),
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
        <Table className="min-w-[880px] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[12%] px-5 py-3 font-semibold">
                {t("iam.team.details.effect")}
              </TableHead>
              <TableHead className="w-[29%] px-5 py-3 font-semibold">
                {t("iam.team.details.resourceScope")}
              </TableHead>
              <TableHead className="w-[31%] px-5 py-3 font-semibold">
                {t("iam.team.details.actions")}
              </TableHead>
              <TableHead className="w-[28%] px-5 py-3 font-semibold">
                {t("iam.team.details.grantedThrough")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
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
              filteredItems.map((permission) => (
                <PermissionRow
                  key={`${permission.policyId}:${permission.statementId}`}
                  permission={permission}
                  lang={lang}
                  t={t}
                />
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-40 px-5 text-center">
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
}: {
  permission: MemberPermission
  lang: Lang
  t: TFunction
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

  return (
    <TableRow>
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
          rawValues={allResources ? permission.resources : permission.resources}
          visibleCount={2}
          t={t}
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
          rawValues={permission.actions}
          visibleCount={3}
          t={t}
        />
      </TableCell>
      <TableCell className="px-5 py-4 align-top whitespace-normal">
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                to={policyUrl}
                className="block truncate text-sm font-semibold text-foreground hover:underline"
              />
            }
          >
            {permission.policyName}
          </TooltipTrigger>
          <TooltipContent className="max-w-[min(28rem,calc(100vw-2rem))] [overflow-wrap:anywhere] break-words">
            {permission.policyName}
          </TooltipContent>
        </Tooltip>
        <SourceSummary sources={permission.sources} t={t} />
      </TableCell>
    </TableRow>
  )
}

function SummaryCell({
  title,
  values,
  rawValues,
  visibleCount,
  t,
}: {
  title: string
  values: string[]
  rawValues: string[]
  visibleCount: number
  t: TFunction
}) {
  const visible = values.slice(0, visibleCount)
  const overflow = Math.max(0, values.length - visible.length)

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <ListChecks className="size-4 shrink-0 text-muted-foreground" />
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                tabIndex={0}
                className="truncate text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            }
          >
            {title}
          </TooltipTrigger>
          <TooltipContent className="max-w-[min(28rem,calc(100vw-2rem))] break-words">
            {title}
          </TooltipContent>
        </Tooltip>
      </div>
      {visible.length ? (
        <div className="mt-1 flex min-w-0 items-center gap-1.5 pl-6 text-xs leading-5 text-muted-foreground">
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  className="truncate outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              }
            >
              {visible.join(", ")}
            </TooltipTrigger>
            <TooltipContent className="max-h-64 max-w-[min(28rem,calc(100vw-2rem))] [scrollbar-width:thin] overflow-y-auto p-3">
              <ul className="space-y-1 font-mono text-xs">
                {rawValues.slice(0, visible.length).map((value, index) => (
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
          {overflow ? (
            <OverflowTooltip
              label={`+${overflow}`}
              heading={t("iam.team.details.completeList")}
              values={rawValues}
            />
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
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              className="truncate outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          {visible.join(" \u00b7 ")}
        </TooltipTrigger>
        <TooltipContent className="max-h-64 max-w-[min(28rem,calc(100vw-2rem))] [scrollbar-width:thin] overflow-y-auto p-3">
          <ul className="space-y-1 text-xs">
            {visible.map((value, index) => (
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

function OverflowTooltip({
  label,
  heading,
  values,
}: {
  label: string
  heading: string
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
        <p className="mb-1.5 font-medium">{heading}</p>
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
