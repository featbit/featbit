import { CalendarClock, GitPullRequest, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import type { PendingFlagChange } from "../../flags-types"
import { useState } from "react"

export function PendingChangesSheet({
  open,
  items,
  removingId,
  onOpenChange,
  onRemove,
}: {
  open: boolean
  items: PendingFlagChange[]
  removingId: string | null
  onOpenChange: (open: boolean) => void
  onRemove: (item: PendingFlagChange) => void
}) {
  const { t, i18n } = useTranslation()
  const [removeTarget, setRemoveTarget] = useState<PendingFlagChange | null>(
    null
  )
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[760px]">
        <SheetHeader className="border-b">
          <SheetTitle>
            {t("featureFlags.detailsPage.pending.title")}{" "}
            <span className="font-normal text-muted-foreground">
              · {items.length}
            </span>
          </SheetTitle>
          <SheetDescription>
            {t("featureFlags.detailsPage.pending.description")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <p className="text-sm text-muted-foreground">
              {t("featureFlags.detailsPage.pending.count", {
                count: items.length,
              })}
            </p>
            <Select defaultValue="all">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {t("featureFlags.detailsPage.pending.allStatuses")}
                  </SelectItem>
                  <SelectItem value="review">
                    {t("featureFlags.detailsPage.pending.pendingReview")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            {items.length ? (
              items.map((item) => (
                <article key={item.id} className="rounded-md border p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-md bg-muted p-2">
                      {item.type === "Schedule" ? (
                        <CalendarClock className="size-4" />
                      ) : (
                        <GitPullRequest className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-medium">
                          {item.scheduleTitle ||
                            (item.type === "Schedule"
                              ? t(
                                  "featureFlags.detailsPage.pending.scheduledTitle"
                                )
                              : t(
                                  "featureFlags.detailsPage.pending.requestTitle"
                                ))}
                        </h3>
                        <Badge variant="secondary">{item.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.creatorName} ·{" "}
                        {new Intl.DateTimeFormat(
                          i18n.resolvedLanguage === "zh" ? "zh-CN" : "en-US",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }
                        ).format(
                          new Date(item.scheduledTime || item.createdAt)
                        )}
                      </p>
                      {item.changeRequestReason ? (
                        <p className="mt-3 text-sm">
                          {item.changeRequestReason}
                        </p>
                      ) : null}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t(
                              "featureFlags.detailsPage.pending.moreActions"
                            )}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={removingId === item.id}
                          onClick={() => setRemoveTarget(item)}
                        >
                          {t("featureFlags.detailsPage.pending.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              ))
            ) : (
              <div className="py-20 text-center">
                <p className="text-sm font-medium">
                  {t("featureFlags.detailsPage.pending.empty")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("featureFlags.detailsPage.pending.emptyHelp")}
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
              {t("featureFlags.detailsPage.pending.removeDescription", {
                name:
                  removeTarget?.scheduleTitle ||
                  t("featureFlags.detailsPage.pending.fallbackName"),
              })}
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
              {t("featureFlags.detailsPage.pending.remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
