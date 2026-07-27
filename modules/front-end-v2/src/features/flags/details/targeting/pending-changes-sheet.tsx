import { useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import type { PendingFlagChange } from "../../flags-types"
import { PendingChangeRow } from "./pending-change-row"
import {
  canApply,
  canReview,
  type PendingAction,
  type PendingStatus,
  type StatusFilter,
} from "./pending-change-utils"

function PendingRowSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="ml-11 h-3 w-3/5" />
      <Skeleton className="ml-11 h-8 w-[calc(100%-2.75rem)]" />
    </div>
  )
}

export function PendingChangesSheet({
  open,
  flagName,
  items,
  loading,
  failed,
  removingId,
  acting,
  onOpenChange,
  onRetry,
  onRemove,
  onAction,
}: {
  open: boolean
  flagName: string
  items: PendingFlagChange[]
  loading: boolean
  failed: boolean
  removingId: string | null
  acting: { id: string; action: PendingAction } | null
  onOpenChange: (open: boolean) => void
  onRetry: () => void
  onRemove: (item: PendingFlagChange) => void
  onAction: (item: PendingFlagChange, action: PendingAction) => void
}) {
  const { t } = useTranslation()
  const currentUserId = getStoredUserProfile().id
  const [removeTarget, setRemoveTarget] = useState<PendingFlagChange | null>(
    null
  )
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [expandedId, setExpandedId] = useState<string | null | undefined>(
    undefined
  )
  const visibleItems = useMemo(
    () =>
      filter === "all" ? items : items.filter((item) => item.status === filter),
    [filter, items]
  )
  const needsReview = items.filter((item) =>
    canReview(item, currentUserId)
  ).length
  const defaultExpandedId =
    items.find(
      (item) => canReview(item, currentUserId) || canApply(item, currentUserId)
    )?.id ?? null
  const visibleExpandedId =
    expandedId === undefined ? defaultExpandedId : expandedId
  const filterLabel =
    filter === "all"
      ? t("featureFlags.detailsPage.pending.allStatuses")
      : t(`featureFlags.detailsPage.pending.status.${filter}`)

  return (
    <Sheet
      open={open}
      disablePointerDismissal={Boolean(removeTarget)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setExpandedId(undefined)
        }
        onOpenChange(nextOpen)
      }}
    >
      <SheetContent className="!w-full gap-0 sm:!max-w-[760px]">
        <SheetHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle>
              {t("featureFlags.detailsPage.pending.title")}
            </SheetTitle>
            <Badge
              variant="secondary"
              className="min-w-5 justify-center px-1.5"
            >
              {items.length}
            </Badge>
          </div>
          <SheetDescription>
            {t("featureFlags.detailsPage.pending.description", {
              name: flagName,
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3">
            <p className="text-sm font-medium">
              {t("featureFlags.detailsPage.pending.summary", {
                count: items.length,
                reviewCount: needsReview,
              })}
            </p>
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as StatusFilter)}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue>{filterLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {t("featureFlags.detailsPage.pending.allStatuses")}
                  </SelectItem>
                  {(
                    [
                      "PendingReview",
                      "Approved",
                      "PendingExecution",
                      "Declined",
                      "Applied",
                    ] as PendingStatus[]
                  ).map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`featureFlags.detailsPage.pending.status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="divide-y rounded-lg border">
                <PendingRowSkeleton />
                <PendingRowSkeleton />
                <PendingRowSkeleton />
              </div>
            ) : failed ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
                <div>
                  <p className="text-sm font-medium">
                    {t("featureFlags.detailsPage.pending.loadFailed")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("featureFlags.detailsPage.pending.loadFailedHelp")}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={onRetry}>
                  {t("featureFlags.retry")}
                </Button>
              </div>
            ) : visibleItems.length ? (
              <div className="divide-y rounded-lg border">
                {visibleItems.map((item) => (
                  <PendingChangeRow
                    key={item.id}
                    item={item}
                    currentUserId={currentUserId}
                    expanded={visibleExpandedId === item.id}
                    removingId={removingId}
                    acting={acting}
                    onToggle={() =>
                      setExpandedId(
                        visibleExpandedId === item.id ? null : item.id
                      )
                    }
                    onRemove={() => setRemoveTarget(item)}
                    onAction={(action) => onAction(item, action)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center text-center">
                <p className="text-sm font-medium">
                  {filter === "all"
                    ? t("featureFlags.detailsPage.pending.empty")
                    : t("featureFlags.detailsPage.pending.filterEmpty")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filter === "all"
                    ? t("featureFlags.detailsPage.pending.emptyHelp")
                    : t("featureFlags.detailsPage.pending.filterEmptyHelp")}
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(next) => !next && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("featureFlags.detailsPage.pending.removeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans
                i18nKey="featureFlags.detailsPage.pending.removeDescription"
                values={{
                  name:
                    removeTarget?.scheduleTitle ||
                    t("featureFlags.detailsPage.pending.fallbackName"),
                }}
                components={{
                  strong: <strong className="font-semibold text-foreground" />,
                }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(removingId)}>
              {t("featureFlags.detailsPage.pending.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!removeTarget || Boolean(removingId)}
              onClick={() => {
                if (!removeTarget) return
                onRemove(removeTarget)
                setRemoveTarget(null)
              }}
            >
              {removingId
                ? t("featureFlags.detailsPage.pending.removing")
                : t("featureFlags.detailsPage.pending.remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
