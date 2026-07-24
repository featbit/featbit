import { ChevronDown, ChevronRight } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
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
import { ChangeLedger } from "@/features/segments/details/components/change-ledger"
import {
  auditEventFragments,
  auditEventTitle,
  auditHistoryChanges,
  auditObjectIdentity,
  auditTypeLabel,
} from "../audit-log-utils"
import type { AuditLog } from "../audit-logs-types"

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
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={`mt-0.5 block max-w-full truncate font-mono text-xs text-muted-foreground ${nameClass}`}
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          {identity.key}
        </TooltipTrigger>
        <TooltipContent>{identity.key}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function AuditLogTable({
  items,
  lang,
  locale,
  loading,
  filtered,
  onClearFilters,
  onViewRawData,
}: {
  items: AuditLog[]
  lang: Lang
  locale: string
  loading: boolean
  filtered: boolean
  onClearFilters: () => void
  onViewRawData: (log: AuditLog) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  )

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
          <TableHead className="w-36">{t("auditLogs.type")}</TableHead>
          <TableHead className="w-64">{t("auditLogs.keyName")}</TableHead>
          <TableHead>{t("auditLogs.event")}</TableHead>
          <TableHead>{t("auditLogs.comment")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <TableRow key={index}>
              <TableCell colSpan={7} className="h-[68px] px-4">
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
            const fragment = auditEventFragments(log, t)
            const changes = auditHistoryChanges(log)
            const comment = log.comment?.trim()
            const hasRawData = Boolean(
              log.dataChange.previous || log.dataChange.current
            )

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
                  <TableCell className="whitespace-nowrap">
                    {auditTypeLabel(log.refType, t)}
                  </TableCell>
                  <TableCell className="max-w-64">
                    <ObjectIdentity log={log} lang={lang} />
                  </TableCell>
                  <TableCell className="max-w-80">
                    <p className="truncate">{auditEventTitle(log, t)}</p>
                    {fragment ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="block max-w-full truncate text-xs text-muted-foreground" />
                          }
                        >
                          {fragment}
                        </TooltipTrigger>
                        <TooltipContent>{fragment}</TooltipContent>
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
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="p-3 whitespace-normal">
                      <div className="rounded-md bg-muted/40 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-sm font-medium">
                              {t("auditLogs.changes")}
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              {t("auditLogs.changeCount", {
                                count: changes.length,
                              })}
                            </span>
                          </div>
                          {hasRawData ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onViewRawData(log)}
                            >
                              {t("auditLogs.viewRawData")}
                            </Button>
                          ) : null}
                        </div>
                        {changes.length ? (
                          <ChangeLedger
                            changes={changes}
                            layout="history"
                            className="max-h-[32rem] bg-transparent p-0"
                          />
                        ) : (
                          <p className="py-5 text-center text-sm text-muted-foreground">
                            {t("auditLogs.noSemanticChanges")}
                          </p>
                        )}
                        <div className="mt-4 border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("auditLogs.comment")}
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
            <TableCell colSpan={7} className="h-48 text-center">
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
