import { CalendarClock, GitPullRequest, MoreHorizontal } from "lucide-react"
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
import type { Lang } from "@/features/layout/layout-types"
import type { PendingFlagChange } from "../../flags-types"
import { useState } from "react"

export function PendingChangesSheet({
  open,
  lang,
  items,
  removingId,
  onOpenChange,
  onRemove,
}: {
  open: boolean
  lang: Lang
  items: PendingFlagChange[]
  removingId: string | null
  onOpenChange: (open: boolean) => void
  onRemove: (item: PendingFlagChange) => void
}) {
  const zh = lang === "zh"
  const [removeTarget, setRemoveTarget] = useState<PendingFlagChange | null>(
    null
  )
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[760px]">
        <SheetHeader className="border-b">
          <SheetTitle>
            {zh ? "待处理变更" : "Pending changes"}{" "}
            <span className="font-normal text-muted-foreground">
              · {items.length}
            </span>
          </SheetTitle>
          <SheetDescription>
            {zh
              ? "查看此功能开关已计划或等待审核的定向变更。"
              : "Review scheduled targeting changes and approval requests for this flag."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <p className="text-sm text-muted-foreground">
              {items.length} {zh ? "项待处理变更" : "pending changes"}
            </p>
            <Select defaultValue="all">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {zh ? "全部状态" : "All statuses"}
                  </SelectItem>
                  <SelectItem value="review">
                    {zh ? "待审核" : "Pending review"}
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
                              ? "Scheduled targeting change"
                              : "Targeting change request")}
                        </h3>
                        <Badge variant="secondary">{item.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.creatorName} ·{" "}
                        {new Intl.DateTimeFormat(zh ? "zh-CN" : "en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(
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
                            aria-label={zh ? "更多操作" : "More actions"}
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
                          {zh ? "移除" : "Remove"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              ))
            ) : (
              <div className="py-20 text-center">
                <p className="text-sm font-medium">
                  {zh ? "没有待处理变更" : "No pending changes"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {zh
                    ? "计划变更和审批请求将显示在这里。"
                    : "Scheduled changes and approval requests will appear here."}
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
              {zh ? "移除待处理变更？" : "Remove pending change?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {zh
                ? "此计划或变更请求将被永久移除。"
                : `This will permanently remove ${removeTarget?.scheduleTitle || "the pending targeting change"}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(removingId)}>
              {zh ? "取消" : "Cancel"}
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
              {zh ? "移除" : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
