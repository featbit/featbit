import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  GitPullRequest,
  Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChangeLedger } from "@/features/change-review/change-ledger"
import type { PendingFlagChange } from "../../flags-types"
import {
  canApply,
  canReview,
  pendingChanges,
  statusClassName,
  type PendingAction,
} from "./pending-change-utils"
import { useFlagChangeLedgerAdapter } from "./use-flag-change-ledger-adapter"

export function PendingChangeRow({
  item,
  currentUserId,
  expanded,
  removingId,
  acting,
  onToggle,
  onRemove,
  onAction,
}: {
  item: PendingFlagChange
  currentUserId?: string
  expanded: boolean
  removingId: string | null
  acting: { id: string; action: PendingAction } | null
  onToggle: () => void
  onRemove: () => void
  onAction: (action: PendingAction) => void
}) {
  const { t, i18n } = useTranslation()
  const ledger = useFlagChangeLedgerAdapter()
  const changes = pendingChanges(item, {
    flagOn: t("featureFlags.detailsPage.flagOn"),
    flagOff: t("featureFlags.detailsPage.flagOff"),
  })
  const reviewable = canReview(item, currentUserId)
  const applicable = canApply(item, currentUserId)
  const isActing = acting?.id === item.id
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  function formatDate(value?: string) {
    if (!value) return ""
    return new Intl.DateTimeFormat(
      i18n.resolvedLanguage === "zh" ? "zh-CN" : "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(new Date(value))
  }

  return (
    <article className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-muted p-2">
          {item.type === "Schedule" ? (
            <CalendarClock className="size-4" />
          ) : (
            <GitPullRequest className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold">
              {item.scheduleTitle ||
                (item.type === "Schedule"
                  ? t("featureFlags.detailsPage.pending.scheduledTitle")
                  : t("featureFlags.detailsPage.pending.requestTitle"))}
            </h3>
            <Badge variant="outline" className={statusClassName(item.status)}>
              {t(`featureFlags.detailsPage.pending.status.${item.status}`)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.type === "Schedule"
              ? t("featureFlags.detailsPage.pending.scheduleType")
              : t("featureFlags.detailsPage.pending.requestType")}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          aria-label={t("featureFlags.detailsPage.pending.remove")}
          disabled={removingId === item.id || isActing}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="mt-3 ml-11 space-y-3">
        {item.type === "Schedule" && item.scheduledTime ? (
          <p className="text-sm font-medium">
            {formatDate(item.scheduledTime)}{" "}
            <span className="font-normal text-muted-foreground">
              {timezone}
            </span>
          </p>
        ) : null}
        {item.changeRequestReason ? (
          <p className="text-sm text-muted-foreground">
            {item.changeRequestReason}
          </p>
        ) : null}
        {item.reviewers?.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">
              {t("featureFlags.detailsPage.pending.reviewers")}
            </span>
            {item.reviewers.map((reviewer) => {
              const decision =
                reviewer.action === "Approve"
                  ? "approved"
                  : reviewer.action === "Decline"
                    ? "declined"
                    : "pending"
              const identity =
                reviewer.name && reviewer.email
                  ? `${reviewer.name} (${reviewer.email})`
                  : reviewer.name ||
                    reviewer.email ||
                    t("featureFlags.detailsPage.pending.reviewerFallback", {
                      id: reviewer.memberId,
                    })
              return (
                <Badge
                  key={reviewer.memberId}
                  variant="secondary"
                  className="gap-1.5 font-normal"
                >
                  <span
                    className={
                      decision === "approved"
                        ? "size-1.5 rounded-full bg-emerald-600"
                        : decision === "declined"
                          ? "size-1.5 rounded-full bg-red-600"
                          : "size-1.5 rounded-full bg-muted-foreground/60"
                    }
                  />
                  {identity}
                  {" · "}
                  {t(
                    `featureFlags.detailsPage.pending.reviewerStatus.${decision}`
                  )}
                </Badge>
              )
            })}
          </div>
        ) : null}
        <div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md py-1 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={onToggle}
          >
            <span>{t("featureFlags.detailsPage.pending.changes")}</span>
            <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              {t("featureFlags.detailsPage.pending.changeCount", {
                count: changes.length,
              })}
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </span>
          </button>
          {expanded ? (
            <ChangeLedger
              changes={changes}
              layout="targeting"
              className="mt-2"
              {...ledger}
            />
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {t("featureFlags.detailsPage.pending.createdBy", {
              name: item.creatorName,
              date: formatDate(item.createdAt),
            })}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {reviewable ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isActing || Boolean(removingId)}
                  onClick={() => onAction("decline")}
                >
                  {isActing && acting?.action === "decline"
                    ? t("featureFlags.detailsPage.pending.declining")
                    : t("featureFlags.detailsPage.pending.decline")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isActing || Boolean(removingId)}
                  onClick={() => onAction("approve")}
                >
                  {isActing && acting?.action === "approve"
                    ? t("featureFlags.detailsPage.pending.approving")
                    : t("featureFlags.detailsPage.pending.approve")}
                </Button>
              </>
            ) : null}
            {applicable ? (
              <Button
                type="button"
                size="sm"
                disabled={isActing || Boolean(removingId)}
                onClick={() => onAction("apply")}
              >
                {isActing && acting?.action === "apply"
                  ? t("featureFlags.detailsPage.pending.applying")
                  : t("featureFlags.detailsPage.pending.apply")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
