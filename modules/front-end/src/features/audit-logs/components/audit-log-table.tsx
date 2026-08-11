import { ChevronDown, ChevronRight } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
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
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import {
  auditDecisionSnapshot,
  auditObjectIdentity,
  auditTypeLabel,
} from "../audit-log-utils"
import type { AuditLog } from "../audit-logs-types"
import {
  type AuditLogTableAdapter,
  useDefaultAuditLogTableAdapter,
} from "./audit-log-table-adapter"

function ObjectIdentity({ log, lang }: { log: AuditLog; lang: Lang }) {
  const { t } = useTranslation()
  const identity = auditObjectIdentity(log, t("auditLogs.unavailable"))
  const href =
    log.refType === "FeatureFlag"
      ? localizedPath(
          lang,
          `/feature-flags/${encodeURIComponent(identity.key)}/targeting`
        )
      : log.refType === "Segment"
        ? localizedPath(
            lang,
            `/segments/${encodeURIComponent(identity.id)}/targeting`
          )
        : ""
  const nameClass = identity.removed ? "line-through" : ""

  return (
    <div className="min-w-0">
      {identity.available && href ? (
        <Link
          to={href}
          className="block truncate text-primary underline-offset-4 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {identity.name}
        </Link>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={`block max-w-full truncate ${nameClass}`}
                onClick={(event) => event.stopPropagation()}
              />
            }
          >
            {identity.name}
          </TooltipTrigger>
          <TooltipContent>{identity.name}</TooltipContent>
        </Tooltip>
      )}
      <span
        className={`mt-0.5 block max-w-full truncate font-mono text-xs text-muted-foreground ${nameClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        {identity.key}
      </span>
    </div>
  )
}

export function AuditLogTable({
  items,
  lang,
  locale,
  loading,
  filtered,
  resourceScoped = false,
  adapter,
  segmentNames,
  onClearFilters,
  onViewRawData,
}: {
  items: AuditLog[]
  lang: Lang
  locale: string
  loading: boolean
  filtered: boolean
  resourceScoped?: boolean
  adapter?: AuditLogTableAdapter
  segmentNames?: ReadonlyMap<string, string>
  onClearFilters: () => void
  onViewRawData: (log: AuditLog) => void
}) {
  const { t } = useTranslation()
  const defaultAdapter = useDefaultAuditLogTableAdapter(segmentNames)
  const rowAdapter = adapter ?? defaultAdapter
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  )
  const columnCount = resourceScoped ? 5 : 7

  function toggleExpanded(logId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(logId)) next.delete(logId)
      else next.add(logId)
      return next
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12" />
          <TableHead className="w-52">{t("auditLogs.date")}</TableHead>
          <TableHead className="w-56">{t("auditLogs.user")}</TableHead>
          {!resourceScoped ? (
            <>
              <TableHead className="w-36">{t("auditLogs.type")}</TableHead>
              <TableHead className="w-64">{t("auditLogs.keyName")}</TableHead>
            </>
          ) : null}
          <TableHead>{t("auditLogs.event")}</TableHead>
          <TableHead>{t("auditLogs.comment")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <TableRow key={index}>
              <TableCell colSpan={columnCount} className="h-[68px] px-4">
                <Skeleton className="h-8 w-full" />
              </TableCell>
            </TableRow>
          ))
        ) : items.length ? (
          items.map((log) => {
            const isExpanded = expanded.has(log.id)
            const creator =
              log.creatorName ||
              log.creatorEmail ||
              log.creatorId ||
              t("auditLogs.system")
            const eventTitle = rowAdapter.eventTitle(log)
            const eventSubtitle = rowAdapter.eventSubtitle(log)
            const changeDetails = rowAdapter.changeDetails(log)
            const decisionDetails = changeDetails.kind === "decision"
            const decisionSnapshot = auditDecisionSnapshot(log)
            const comment = log.comment?.trim()
            const rawDataLog = decisionDetails
              ? decisionSnapshot?.proposedDataChange
                ? { ...log, dataChange: decisionSnapshot.proposedDataChange }
                : null
              : log.dataChange.previous || log.dataChange.current
                ? log
                : null

            return (
              <Fragment key={log.id}>
                <TableRow
                  className="h-[68px] cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpanded(log.id)}
                >
                  <TableCell>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? t("auditLogs.collapse")
                          : t("auditLogs.expand")
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpanded(log.id)
                      }}
                    >
                      {isExpanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {dateFormatter.format(new Date(log.createdAt))}
                  </TableCell>
                  <TableCell className="max-w-56">
                    <p className="truncate">{creator}</p>
                    {log.creatorName && log.creatorEmail ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {log.creatorEmail}
                      </p>
                    ) : null}
                  </TableCell>
                  {!resourceScoped ? (
                    <>
                      <TableCell className="whitespace-nowrap">
                        {auditTypeLabel(log.refType, t)}
                      </TableCell>
                      <TableCell className="max-w-64">
                        <ObjectIdentity log={log} lang={lang} />
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="max-w-80">
                    <p className="truncate">{eventTitle}</p>
                    {eventSubtitle ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="inline-block max-w-full truncate align-middle text-xs text-muted-foreground" />
                          }
                        >
                          {eventSubtitle}
                        </TooltipTrigger>
                        <TooltipContent>{eventSubtitle}</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-80">
                    {comment ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="inline-block max-w-full truncate align-middle text-sm" />
                          }
                        >
                          {comment}
                        </TooltipTrigger>
                        <TooltipContent>{comment}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>

                {isExpanded ? (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell
                      colSpan={columnCount}
                      className="px-16 py-4 whitespace-normal"
                    >
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-sm font-medium">
                              {t(
                                decisionDetails
                                  ? "auditLogs.decision"
                                  : "auditLogs.changes"
                              )}
                            </h3>
                            {!decisionDetails ? (
                              <span className="text-sm text-muted-foreground">
                                {t("auditLogs.changeCount", {
                                  count: changeDetails.count,
                                })}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {decisionSnapshot?.changeRequestId ? (
                              <Link
                                to={`${localizedPath(
                                  lang,
                                  "/change-requests"
                                )}?changeRequestId=${encodeURIComponent(
                                  decisionSnapshot.changeRequestId
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  })
                                )}
                              >
                                <span className="translate-y-px">
                                  {t("auditLogs.viewChangeRequest")}
                                </span>
                              </Link>
                            ) : null}
                            {rawDataLog ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onViewRawData(rawDataLog)}
                              >
                                <span className="translate-y-px">
                                  {t("auditLogs.viewRawData")}
                                </span>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {changeDetails.content ? (
                          <div className="max-w-3xl">
                            {changeDetails.content}
                          </div>
                        ) : !decisionDetails ? (
                          <p className="py-5 text-center text-sm text-muted-foreground">
                            {t("auditLogs.noSemanticChanges")}
                          </p>
                        ) : null}
                        <div className="mt-4 border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t(
                              decisionDetails
                                ? "auditLogs.reviewerComment"
                                : "auditLogs.comment"
                            )}
                          </p>
                          <p
                            className={
                              comment
                                ? "mt-1 text-sm break-words whitespace-pre-wrap"
                                : "mt-1 text-sm text-muted-foreground"
                            }
                          >
                            {comment || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )
          })
        ) : (
          <TableRow>
            <TableCell colSpan={columnCount} className="h-48 text-center">
              <div className="mx-auto max-w-md space-y-2">
                <p className="font-medium">
                  {filtered
                    ? t("auditLogs.filteredEmptyTitle")
                    : t("auditLogs.emptyTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {filtered
                    ? t("auditLogs.filteredEmptyDescription")
                    : t("auditLogs.emptyDescription")}
                </p>
                {filtered ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearFilters}
                  >
                    {t("auditLogs.clearFilters")}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
