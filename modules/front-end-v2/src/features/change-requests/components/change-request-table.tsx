import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
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
import { ChangeLedger } from "@/features/change-review/change-ledger"
import type { PendingFlagChange } from "@/features/flags/flags-types"
import {
  pendingChanges,
  statusClassName,
} from "@/features/flags/details/targeting/pending-change-utils"
import { useFlagChangeLedgerAdapter } from "@/features/flags/details/targeting/use-flag-change-ledger-adapter"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { ChangeRequestsCopy } from "../change-requests-copy"
import type {
  ChangeRequestAction,
  ChangeRequestItem,
  ChangeRequestReviewer,
} from "../change-requests-types"

const avatarColors = [
  "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
]

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function colorFor(value: string) {
  const hash = Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  )
  return avatarColors[hash % avatarColors.length]
}

function ReviewerAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-medium ${colorFor(name)}`}
    >
      {initials(name)}
    </span>
  )
}

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

function relativeTime(value: string, locale: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ""

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(deltaSeconds)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  if (absoluteSeconds < 60) return formatter.format(deltaSeconds, "second")
  if (absoluteSeconds < 3_600)
    return formatter.format(Math.round(deltaSeconds / 60), "minute")
  if (absoluteSeconds < 86_400)
    return formatter.format(Math.round(deltaSeconds / 3_600), "hour")
  if (absoluteSeconds < 604_800)
    return formatter.format(Math.round(deltaSeconds / 86_400), "day")

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(timestamp)
  )
}

function ReviewerList({
  reviewers,
  currentUserId,
  copy,
}: {
  reviewers: ChangeRequestReviewer[]
  currentUserId?: string
  copy: ChangeRequestsCopy
}) {
  const visible = reviewers.slice(0, 2)

  return (
    <div className="space-y-1">
      {visible.map((reviewer) => {
        const name =
          reviewer.memberId === currentUserId
            ? copy.you
            : reviewer.name ||
              reviewer.email ||
              copy.reviewerFallback(reviewer.memberId)
        const decision = reviewerDecision(reviewer)
        return (
          <div
            key={reviewer.memberId}
            className="flex min-w-0 items-center gap-2"
          >
            <ReviewerAvatar name={name} />
            <span className="max-w-32 truncate text-sm" title={name}>
              {name}
            </span>
            <span
              className={`size-1.5 shrink-0 rounded-full ${reviewerDot(decision)}`}
              title={copy.reviewerStatuses[decision]}
            />
          </div>
        )
      })}
      {reviewers.length > visible.length ? (
        <span className="pl-8 text-xs text-muted-foreground">
          +{reviewers.length - visible.length}
        </span>
      ) : null}
    </div>
  )
}

export function ChangeRequestTable({
  items,
  lang,
  locale,
  envName,
  currentUserId,
  loading,
  filtered,
  acting,
  copy,
  onAction,
  onClearFilters,
}: {
  items: ChangeRequestItem[]
  lang: Lang
  locale: string
  envName: string
  currentUserId?: string
  loading: boolean
  filtered: boolean
  acting: { id: string; action: ChangeRequestAction } | null
  copy: ChangeRequestsCopy
  onAction: (item: ChangeRequestItem, action: ChangeRequestAction) => void
  onClearFilters: () => void
}) {
  const ledger = useFlagChangeLedgerAdapter()
  const [expandedId, setExpandedId] = useState<string | null | undefined>(
    undefined
  )
  const defaultExpandedId = useMemo(
    () => items.find((item) => item.canReview)?.id ?? null,
    [items]
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
            {copy.request}
          </TableHead>
          <TableHead className="w-48">{copy.author}</TableHead>
          <TableHead className="w-56">{copy.reviewers}</TableHead>
          <TableHead className="w-36">{copy.status}</TableHead>
          <TableHead className="w-32">{copy.updated}</TableHead>
          <TableHead className="w-52 text-center">{copy.actions}</TableHead>
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
              item.creatorName || item.creatorEmail || copy.unknownUser
            const requestTitle = item.reason?.trim() || copy.fallbackRequest
            const flagName = item.flagName || copy.unavailableFlag
            const targetingHref = item.flagKey
              ? `${localizedPath(
                  lang,
                  `/feature-flags/${encodeURIComponent(item.flagKey)}/targeting`
                )}?changeRequestId=${encodeURIComponent(item.id)}&mode=preview`
              : ""
            const changes = pendingChanges(toPendingChange(item), {
              flagOn: copy.flagOn,
              flagOff: copy.flagOff,
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
                      aria-label={expanded ? copy.collapse : copy.expand}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpanded(item.id)
                      }}
                    >
                      {expanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                  </TableCell>
                  <TableCell className="w-[19rem] max-w-[19rem] py-3">
                    <p className="truncate font-medium" title={requestTitle}>
                      {requestTitle}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {flagName}
                      {item.flagKey ? ` · ${item.flagKey}` : ""}
                      {envName ? ` · ${envName}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="w-48 max-w-48 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{creator}</p>
                      {item.creatorName && item.creatorEmail ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {item.creatorEmail}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <ReviewerList
                      reviewers={item.reviewers}
                      currentUserId={currentUserId}
                      copy={copy}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={statusClassName(item.status)}
                    >
                      {copy.statuses[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {relativeTime(item.updatedAt || item.createdAt, locale)}
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
                            ? copy.declining
                            : copy.decline}
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
                            ? copy.approving
                            : copy.approve}
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
                          ? copy.applying
                          : copy.apply}
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
                      <div className="max-w-3xl">
                        <div>
                          <div className="mb-2 flex items-baseline gap-2">
                            <h3 className="text-sm font-medium">
                              {copy.targetingChanges}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {copy.changeCount(changes.length)}
                            </span>
                          </div>
                          {changes.length ? (
                            <ChangeLedger
                              changes={changes}
                              layout="targeting"
                              className="max-h-none bg-transparent p-0"
                              {...ledger}
                            />
                          ) : (
                            <p className="py-3 text-sm text-muted-foreground">
                              {copy.noChanges}
                            </p>
                          )}
                        </div>
                        {targetingHref ? (
                          <Link
                            to={targetingHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex h-8 items-center gap-1.5 text-sm font-medium underline underline-offset-4"
                          >
                            {copy.viewInTargeting}
                            <ExternalLink className="size-3.5" />
                          </Link>
                        ) : null}
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
                  {filtered ? copy.filteredEmptyTitle : copy.emptyTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {filtered
                    ? copy.filteredEmptyDescription
                    : copy.emptyDescription}
                </p>
                {filtered ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearFilters}
                  >
                    {copy.clearFilters}
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
