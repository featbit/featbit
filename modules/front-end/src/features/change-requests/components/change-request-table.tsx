import { Box, ChevronDown, ChevronRight, Copy } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
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
import { ChangeLedger } from "@/features/change-review/change-ledger"
import type { PendingFlagChange } from "@/features/flags/flags-types"
import {
  pendingChanges,
  statusClassName,
} from "@/features/flags/details/targeting/pending-change-utils"
import { useFlagChangeLedgerAdapter } from "@/features/flags/details/targeting/use-flag-change-ledger-adapter"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import type {
  ChangeRequestAction,
  ChangeRequestItem,
  ChangeRequestReviewer,
} from "../change-requests-types"

function reviewerDecision(reviewer: ChangeRequestReviewer) {
  if (reviewer.action === "Approve") return "approved"
  if (reviewer.action === "Decline") return "declined"
  return "pending"
}

function reviewerDot(decision: ReturnType<typeof reviewerDecision>) {
  if (decision === "approved") return "bg-emerald-600"
  if (decision === "declined") return "bg-red-600"
  return "bg-amber-500"
}

function TeamMemberLink({
  id,
  name,
  email,
  lang,
  className,
}: {
  id: string
  name: string
  email?: string
  lang: Lang
  className?: string
}) {
  const link = (
    <Link
      to={localizedPath(
        lang,
        `/iam/team/${encodeURIComponent(id)}/permissions`
      )}
      target="_blank"
      rel="noopener noreferrer"
      className={`truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className ?? ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      {name}
    </Link>
  )

  return email ? (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>{email}</TooltipContent>
    </Tooltip>
  ) : (
    link
  )
}

function toPendingChange(item: ChangeRequestItem): PendingFlagChange {
  return {
    id: item.id,
    type: "ChangeRequest",
    status: item.status,
    flagId: item.flagId,
    creatorId: item.creatorId,
    creatorName: item.creatorName,
    createdAt: item.createdAt,
    dataChange: item.dataChange,
    instructions: item.instructions,
    changeRequestId: item.id,
    changeRequestReason: item.reason,
    reviewers: item.reviewers,
  }
}

function formatDate(value: string, lang: Lang, withTime = false) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date)
}

function ReviewerList({
  reviewers,
  currentUserId,
  lang,
}: {
  reviewers: ChangeRequestReviewer[]
  currentUserId?: string
  lang: Lang
}) {
  const { t } = useTranslation()
  const visible = reviewers.slice(0, 2)

  return (
    <div className="space-y-1">
      {visible.map((reviewer) => {
        const name =
          reviewer.memberId === currentUserId
            ? t("changeRequests.you")
            : reviewer.name ||
              reviewer.email ||
              t("changeRequests.reviewerFallback", { id: reviewer.memberId })
        const decision = reviewerDecision(reviewer)
        return (
          <div
            key={reviewer.memberId}
            className="flex min-w-0 items-center gap-1.5"
          >
            <TeamMemberLink
              id={reviewer.memberId}
              name={name}
              email={reviewer.email}
              lang={lang}
              className="max-w-32 text-sm"
            />
            <span
              className={`size-1.5 shrink-0 rounded-full ${reviewerDot(decision)}`}
              title={t(`changeRequests.reviewerStatuses.${decision}`)}
            />
          </div>
        )
      })}
      {reviewers.length > visible.length ? (
        <span className="text-xs text-muted-foreground">
          +{reviewers.length - visible.length}
        </span>
      ) : null}
    </div>
  )
}

export function ChangeRequestTable({
  items,
  initialExpandedId,
  focused = false,
  lang,
  currentUserId,
  loading,
  filtered,
  acting,
  onAction,
  onCopyKey,
  onClearFilters,
}: {
  items: ChangeRequestItem[]
  initialExpandedId?: string
  focused?: boolean
  lang: Lang
  currentUserId?: string
  loading: boolean
  filtered: boolean
  acting: { id: string; action: ChangeRequestAction } | null
  onAction: (item: ChangeRequestItem, action: ChangeRequestAction) => void
  onCopyKey: (key: string) => void
  onClearFilters: () => void
}) {
  const { t } = useTranslation()
  const ledger = useFlagChangeLedgerAdapter()
  const [expandedId, setExpandedId] = useState<string | null | undefined>(
    undefined
  )
  const defaultExpandedId = useMemo(
    () =>
      items.some((item) => item.id === initialExpandedId)
        ? initialExpandedId!
        : (items.find((item) => item.canReview)?.id ?? null),
    [initialExpandedId, items]
  )
  const visibleExpandedId =
    expandedId === undefined ? defaultExpandedId : expandedId

  function toggleExpanded(id: string) {
    setExpandedId(visibleExpandedId === id ? null : id)
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12" />
          <TableHead className="w-[19rem] max-w-[19rem]">
            {t("changeRequests.request")}
          </TableHead>
          <TableHead className="w-72">{t("changeRequests.scope")}</TableHead>
          <TableHead className="w-56">
            {t("changeRequests.reviewers")}
          </TableHead>
          <TableHead className="w-36">{t("changeRequests.status")}</TableHead>
          <TableHead className="w-48">
            {t("changeRequests.lastChange")}
          </TableHead>
          <TableHead className="w-52 text-center">
            {t("changeRequests.actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <TableRow key={index}>
              <TableCell colSpan={7} className="h-[76px] px-4">
                <Skeleton className="h-10 w-full" />
              </TableCell>
            </TableRow>
          ))
        ) : items.length ? (
          items.map((item) => {
            const expanded = visibleExpandedId === item.id
            const creator =
              item.creatorName ||
              item.creatorEmail ||
              t("changeRequests.unknownUser")
            const updator =
              item.updatorName ||
              item.updatorEmail ||
              t("changeRequests.unknownUser")
            const requestTitle =
              item.reason?.trim() || t("changeRequests.fallbackRequest")
            const targetingHref = item.flagKey
              ? `${localizedPath(
                  lang,
                  `/feature-flags/${encodeURIComponent(item.flagKey)}/targeting`
                )}?changeRequestId=${encodeURIComponent(item.id)}&mode=preview`
              : ""
            const changes = pendingChanges(toPendingChange(item), {
              flagOn: t("featureFlags.detailsPage.flagOn"),
              flagOff: t("featureFlags.detailsPage.flagOff"),
            })
            const isActing = acting?.id === item.id

            return (
              <Fragment key={item.id}>
                <TableRow
                  className="min-h-[76px] cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpanded(item.id)}
                >
                  <TableCell>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-expanded={expanded}
                      aria-label={t(
                        expanded
                          ? "changeRequests.collapse"
                          : "changeRequests.expand"
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpanded(item.id)
                      }}
                    >
                      {expanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                  </TableCell>
                  <TableCell className="w-[19rem] max-w-[19rem] py-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium" title={requestTitle}>
                        {requestTitle}
                      </p>
                      {item.flagKey ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={t("changeRequests.copyKey", {
                                  key: item.flagKey,
                                })}
                                className="inline-flex max-w-full items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onCopyKey(item.flagKey)
                                }}
                              />
                            }
                          >
                            <span className="truncate">{item.flagKey}</span>
                            <Copy className="size-3 shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>{item.flagKey}</TooltipContent>
                        </Tooltip>
                      ) : null}
                      <p className="flex min-w-0 items-center gap-1.5 text-xs">
                        <span className="shrink-0 text-muted-foreground">
                          {t("changeRequests.createdBy")}
                        </span>
                        <TeamMemberLink
                          id={item.creatorId}
                          name={creator}
                          email={item.creatorEmail}
                          lang={lang}
                        />
                        <span className="shrink-0 text-muted-foreground">
                          · {formatDate(item.createdAt, lang)}
                        </span>
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="w-72 max-w-72 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Box
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span
                        className="truncate font-mono text-xs text-muted-foreground"
                        title={item.scopeRn || undefined}
                      >
                        {item.scopeRn || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <ReviewerList
                      reviewers={item.reviewers}
                      currentUserId={currentUserId}
                      lang={lang}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={statusClassName(item.status)}
                    >
                      {t(`changeRequests.statuses.${item.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-48 max-w-48 py-3">
                    <div className="max-w-full min-w-0 space-y-1 text-sm">
                      <p>
                        {formatDate(
                          item.updatedAt || item.createdAt,
                          lang,
                          true
                        )}
                      </p>
                      <p className="flex min-w-0 items-center gap-1.5 text-xs">
                        <span className="shrink-0 text-muted-foreground">
                          {t("changeRequests.updatedBy")}
                        </span>
                        <TeamMemberLink
                          id={item.updatorId}
                          name={updator}
                          email={item.updatorEmail}
                          lang={lang}
                        />
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="w-52 py-3 text-center">
                    {item.canReview ? (
                      <div className="flex justify-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isActing}
                          onClick={(event) => {
                            event.stopPropagation()
                            onAction(item, "decline")
                          }}
                        >
                          {isActing && acting?.action === "decline"
                            ? t("changeRequests.declining")
                            : t("changeRequests.decline")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isActing}
                          onClick={(event) => {
                            event.stopPropagation()
                            onAction(item, "approve")
                          }}
                        >
                          {isActing && acting?.action === "approve"
                            ? t("changeRequests.approving")
                            : t("changeRequests.approve")}
                        </Button>
                      </div>
                    ) : item.canApply ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isActing}
                        onClick={(event) => {
                          event.stopPropagation()
                          onAction(item, "apply")
                        }}
                      >
                        {isActing && acting?.action === "apply"
                          ? t("changeRequests.applying")
                          : t("changeRequests.apply")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>

                {expanded ? (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell
                      colSpan={7}
                      className="px-16 py-4 whitespace-normal"
                    >
                      <div>
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-sm font-medium">
                              {t("changeRequests.targetingChanges")}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {t("changeRequests.changeCount", {
                                count: changes.length,
                              })}
                            </span>
                          </div>
                          {targetingHref ? (
                            <Link
                              to={targetingHref}
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
                                {t("changeRequests.viewInTargeting")}
                              </span>
                            </Link>
                          ) : null}
                        </div>
                        <div className="max-w-3xl">
                          {changes.length ? (
                            <ChangeLedger
                              changes={changes}
                              layout="history"
                              className="max-h-[32rem] bg-transparent p-0"
                              {...ledger}
                            />
                          ) : (
                            <p className="py-3 text-sm text-muted-foreground">
                              {t("changeRequests.noChanges")}
                            </p>
                          )}
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
            <TableCell colSpan={7} className="h-52 text-center">
              <div className="mx-auto max-w-md space-y-2">
                <p className="font-medium">
                  {focused
                    ? t("changeRequests.unavailableTitle")
                    : filtered
                      ? t("changeRequests.filteredEmptyTitle")
                      : t("changeRequests.emptyTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {focused
                    ? t("changeRequests.unavailableDescription")
                    : filtered
                      ? t("changeRequests.filteredEmptyDescription")
                      : t("changeRequests.emptyDescription")}
                </p>
                {filtered ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearFilters}
                  >
                    {t(
                      focused
                        ? "changeRequests.viewAll"
                        : "changeRequests.clearFilters"
                    )}
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
