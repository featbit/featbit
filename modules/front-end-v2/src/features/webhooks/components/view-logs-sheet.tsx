import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ExpandIcon,
  CircleAlert,
  Clock,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { WEBHOOK_EVENTS } from "../webhook-events"
import { fetchWebhookDeliveries } from "../webhooks-api"
import type { Webhook } from "../webhook-types"
import { formatDateTime } from "../webhook-utils"
import { DeliveryDetail } from "./delivery-detail"

type StatusFilter = "all" | "succeeded" | "failed"

export function ViewLogsSheet({
  webhook,
  open,
  onOpenChange,
}: {
  webhook: Webhook | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!open || !webhook) return null

  return <ViewLogsSheetContent webhook={webhook} onOpenChange={onOpenChange} />
}

function ViewLogsSheetContent({
  webhook,
  onOpenChange,
}: {
  webhook: Webhook
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const [event, setEvent] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: [
      "webhook-deliveries",
      webhook.id,
      event,
      status,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchWebhookDeliveries({
        webhookId: webhook.id,
        event,
        success:
          status === "all" ? undefined : status === "succeeded" ? true : false,
        pageIndex: pageIndex - 1,
        pageSize,
      }),
    placeholderData: keepPreviousData,
  })

  const data = query.data ?? { totalCount: 0, items: [] }
  const effectiveExpandedId =
    expandedId === null ? (data.items[0]?.id ?? "") : expandedId
  const pageCount = Math.max(1, Math.ceil(data.totalCount / pageSize))
  const from = data.totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const to = Math.min(pageIndex * pageSize, data.totalCount)

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,1000px)] data-[side=right]:sm:max-w-[1000px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="truncate text-lg">
            {t("webhooks.logs.title", { name: webhook.name })}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("webhooks.logs.srDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-4 border-b px-6 py-4">
            <Select
              value={event || "all"}
              onValueChange={(value) => {
                if (!value) return
                setEvent(value === "all" ? "" : value)
                setPageIndex(1)
                setExpandedId(null)
              }}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {t("webhooks.logs.allEvents")}
                  </SelectItem>
                </SelectGroup>
                {(["featureFlag", "segment"] as const).map((group) => (
                  <SelectGroup key={group}>
                    <SelectLabel>
                      {t(`webhooks.eventGroups.${group}`)}
                    </SelectLabel>
                    {WEBHOOK_EVENTS.filter((item) => item.group === group).map(
                      (item) => (
                        <SelectItem key={item.value} value={item.value}>
                          <span className="flex flex-col">
                            <span>{t(`webhooks.events.${item.labelKey}`)}</span>
                            <code className="text-xs text-muted-foreground">
                              {item.value}
                            </code>
                          </span>
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {t("webhooks.logs.past15Days")}
            </span>

            <div className="ml-auto inline-flex rounded-md border bg-muted/20 p-0.5">
              {(["all", "succeeded", "failed"] as StatusFilter[]).map(
                (value) => (
                  <button
                    type="button"
                    key={value}
                    className={cn(
                      "rounded-sm px-3 py-1.5 text-sm text-muted-foreground transition-colors",
                      status === value &&
                        "bg-background text-foreground shadow-sm"
                    )}
                    onClick={() => {
                      setStatus(value)
                      setPageIndex(1)
                      setExpandedId(null)
                    }}
                  >
                    {t(`webhooks.logs.status.${value}`)}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {query.isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <span className="text-destructive">
                  {t("webhooks.logs.loadFailed")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3"
                  onClick={() => void query.refetch()}
                >
                  {t("webhooks.retry")}
                </Button>
              </div>
            ) : query.isLoading ? (
              <div className="overflow-hidden rounded-lg border">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="flex gap-4 border-b p-4 last:border-0"
                  >
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 flex-1" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                ))}
              </div>
            ) : data.items.length === 0 ? (
              <div className="py-20 text-center">
                <p className="font-medium">
                  {t(
                    event || status !== "all"
                      ? "webhooks.logs.filteredEmpty"
                      : "webhooks.logs.empty"
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("webhooks.logs.emptyHelper")}
                </p>
                {event || status !== "all" ? (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setEvent("")
                      setStatus("all")
                      setPageIndex(1)
                    }}
                  >
                    {t("webhooks.logs.clearFilters")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-12" />
                      <TableHead className="w-28">
                        {t("webhooks.columns.status")}
                      </TableHead>
                      <TableHead>{t("webhooks.columns.events")}</TableHead>
                      <TableHead className="w-56">
                        {t("webhooks.logs.happenedAt")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((delivery) => {
                      const expanded = effectiveExpandedId === delivery.id
                      const responseStatus =
                        delivery.response?.statusCode ?? "ERROR"
                      return (
                        <TableRow
                          key={delivery.id}
                          className="hover:bg-transparent"
                        >
                          <TableCell colSpan={4} className="p-0">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              className="grid w-full grid-cols-[3rem_7rem_minmax(0,1fr)_14rem] items-center text-left hover:bg-muted/30"
                              onClick={() =>
                                setExpandedId(expanded ? "" : delivery.id)
                              }
                            >
                              <span className="flex h-14 items-center justify-center">
                                {expanded ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ExpandIcon className="size-4" />
                                )}
                              </span>
                              <span>
                                <Badge
                                  variant="outline"
                                  className={
                                    delivery.success
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-destructive"
                                  }
                                >
                                  {delivery.success ? (
                                    <CheckCircle2 />
                                  ) : (
                                    <CircleAlert />
                                  )}
                                  {responseStatus}
                                </Badge>
                              </span>
                              <code className="truncate pr-4 text-xs">
                                {delivery.events}
                              </code>
                              <span className="pr-4 text-sm">
                                {formatDateTime(
                                  delivery.startedAt,
                                  i18n.resolvedLanguage
                                )}
                              </span>
                            </button>
                            {expanded ? (
                              <DeliveryDetail delivery={delivery} />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t bg-background px-6 py-4 text-sm text-muted-foreground">
            <span>
              {t("webhooks.logs.showing", { from, to, total: data.totalCount })}
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  if (!value) return
                  setPageSize(Number(value))
                  setPageIndex(1)
                  setExpandedId(null)
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[5, 10, 20].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {t("webhooks.perPage", { count: size })}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={pageIndex <= 1}
                onClick={() => {
                  setPageIndex((current) => current - 1)
                  setExpandedId(null)
                }}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-8 text-center text-foreground">
                {pageIndex} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={pageIndex >= pageCount}
                onClick={() => {
                  setPageIndex((current) => current + 1)
                  setExpandedId(null)
                }}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
