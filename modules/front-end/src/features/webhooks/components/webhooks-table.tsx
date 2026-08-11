import { CheckCircle2, Circle, CircleAlert, MoreHorizontal } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { WEBHOOK_EVENTS } from "../webhook-events"
import type { Webhook } from "../webhook-types"
import { creatorLabel, formatDateTime } from "../webhook-utils"

type Props = {
  items: Webhook[]
  isLoading: boolean
  onView: (webhook: Webhook) => void
  onEdit: (webhook: Webhook) => void
  onDebug: (webhook: Webhook) => void
  onViewLogs: (webhook: Webhook) => void
  onRemove: (webhook: Webhook) => void
}

export function WebhooksTable({
  items,
  isLoading,
  onView,
  onEdit,
  onDebug,
  onViewLogs,
  onRemove,
}: Props) {
  const { t, i18n } = useTranslation()
  const [openEventsId, setOpenEventsId] = useState<string | null>(null)
  const closeEventsTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (closeEventsTimer.current) {
        window.clearTimeout(closeEventsTimer.current)
      }
    },
    []
  )

  function openEvents(webhookId: string) {
    if (closeEventsTimer.current) {
      window.clearTimeout(closeEventsTimer.current)
      closeEventsTimer.current = null
    }
    setOpenEventsId(webhookId)
  }

  function scheduleEventsClose(webhookId: string) {
    if (closeEventsTimer.current) {
      window.clearTimeout(closeEventsTimer.current)
    }
    closeEventsTimer.current = window.setTimeout(() => {
      setOpenEventsId((current) => (current === webhookId ? null : current))
      closeEventsTimer.current = null
    }, 150)
  }

  function eventLabel(value: string) {
    const definition = WEBHOOK_EVENTS.find((event) => event.value === value)
    return definition ? t(`webhooks.events.${definition.labelKey}`) : value
  }

  function eventSummaryLabel(value: string) {
    const definition = WEBHOOK_EVENTS.find((event) => event.value === value)
    if (!definition) return value
    return `${t(`webhooks.eventGroups.${definition.group}`)} · ${t(
      `webhooks.events.${definition.labelKey}`
    )}`
  }

  return (
    <TooltipProvider delay={300}>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="border-b text-left text-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[20%] px-5 py-4 font-semibold">
                {t("webhooks.columns.webhook")}
              </TableHead>
              <TableHead className="w-[14%] px-5 py-4 font-semibold">
                {t("webhooks.columns.status")}
              </TableHead>
              <TableHead className="w-[22%] px-5 py-4 font-semibold">
                {t("webhooks.columns.endpoint")}
              </TableHead>
              <TableHead className="w-[19%] px-5 py-4 font-semibold">
                {t("webhooks.columns.scopes")}
              </TableHead>
              <TableHead className="w-[13%] px-5 py-4 font-semibold">
                {t("webhooks.columns.events")}
              </TableHead>
              <TableHead className="w-[13%] px-5 py-4 font-semibold">
                {t("webhooks.columns.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 6 }, (_, cell) => (
                      <TableCell
                        key={cell}
                        className={cell === 0 ? "pl-4" : ""}
                      >
                        <Skeleton className="h-5 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : items.map((webhook) => {
                  const firstEvent = webhook.events[0]
                  const extraEvents = Math.max(0, webhook.events.length - 1)
                  return (
                    <TableRow key={webhook.id}>
                      <TableCell className="pl-4 align-middle">
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                          onClick={() => onView(webhook)}
                        >
                          {webhook.name}
                        </button>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t("webhooks.createdBy", {
                            creator: creatorLabel(webhook.creator),
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle">
                        <button
                          type="button"
                          className="space-y-1.5 text-left"
                          onClick={() => onViewLogs(webhook)}
                        >
                          <span
                            className={
                              webhook.isActive
                                ? "flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                                : "flex items-center gap-1.5 text-muted-foreground"
                            }
                          >
                            {webhook.isActive ? (
                              <span className="size-2 rounded-full bg-current" />
                            ) : (
                              <Circle className="size-3" />
                            )}
                            {t(
                              webhook.isActive
                                ? "webhooks.status.active"
                                : "webhooks.status.inactive"
                            )}
                          </span>
                          {webhook.lastDelivery ? (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {webhook.lastDelivery.success ? (
                                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <CircleAlert className="size-4 text-destructive" />
                              )}
                              {webhook.lastDelivery.response || "ERROR"}
                              <span aria-hidden="true">·</span>
                              {formatDateTime(
                                webhook.lastDelivery.happenedAt,
                                i18n.resolvedLanguage
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("webhooks.status.neverTriggered")}
                            </span>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-72 align-middle">
                        <Tooltip>
                          <TooltipTrigger
                            render={<code className="block truncate text-xs" />}
                          >
                            {webhook.url}
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md font-mono break-all">
                            {webhook.url}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        <div className="flex flex-wrap gap-1.5">
                          {(webhook.scopeNames ?? []).map((scope, index) => (
                            <Tooltip key={`${scope}-${index}`}>
                              <TooltipTrigger
                                render={
                                  <Badge
                                    variant="outline"
                                    className="max-w-full font-normal"
                                  />
                                }
                              >
                                <span className="truncate">{scope}</span>
                              </TooltipTrigger>
                              <TooltipContent>{scope}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        {firstEvent ? (
                          <Popover
                            open={openEventsId === webhook.id}
                            onOpenChange={(open) =>
                              setOpenEventsId(open ? webhook.id : null)
                            }
                          >
                            <PopoverTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-auto gap-1.5 p-0 hover:bg-transparent"
                                  aria-label={t("webhooks.actions.showEvents", {
                                    count: webhook.events.length,
                                  })}
                                  onMouseEnter={() => openEvents(webhook.id)}
                                  onMouseLeave={() =>
                                    scheduleEventsClose(webhook.id)
                                  }
                                />
                              }
                            >
                              <Badge
                                variant="secondary"
                                className="font-normal"
                              >
                                {eventSummaryLabel(firstEvent)}
                              </Badge>
                              {extraEvents > 0 ? (
                                <Badge variant="outline">+{extraEvents}</Badge>
                              ) : null}
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="max-h-72 w-80 overflow-y-auto p-3"
                              onMouseEnter={() => openEvents(webhook.id)}
                              onMouseLeave={() =>
                                scheduleEventsClose(webhook.id)
                              }
                            >
                              <div className="space-y-4">
                                {(["featureFlag", "segment"] as const).map(
                                  (group) => {
                                    const groupEvents = webhook.events.filter(
                                      (event) =>
                                        WEBHOOK_EVENTS.find(
                                          (definition) =>
                                            definition.value === event
                                        )?.group === group
                                    )
                                    return groupEvents.length ? (
                                      <section key={group}>
                                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                                          {t(`webhooks.eventGroups.${group}`)}
                                        </h4>
                                        <ul className="space-y-2">
                                          {groupEvents.map((event) => (
                                            <li key={event}>
                                              <span className="block text-sm">
                                                {eventLabel(event)}
                                              </span>
                                              <code className="block text-xs text-muted-foreground">
                                                {event}
                                              </code>
                                            </li>
                                          ))}
                                        </ul>
                                      </section>
                                    ) : null
                                  }
                                )}
                                {webhook.events.some(
                                  (event) =>
                                    !WEBHOOK_EVENTS.some(
                                      (definition) => definition.value === event
                                    )
                                ) ? (
                                  <ul className="space-y-2">
                                    {webhook.events
                                      .filter(
                                        (event) =>
                                          !WEBHOOK_EVENTS.some(
                                            (definition) =>
                                              definition.value === event
                                          )
                                      )
                                      .map((event) => (
                                        <li key={event}>
                                          <code className="text-xs">
                                            {event}
                                          </code>
                                        </li>
                                      ))}
                                  </ul>
                                ) : null}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-2 align-middle">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(webhook)}
                          >
                            {t("webhooks.actions.edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDebug(webhook)}
                          >
                            {t("webhooks.actions.liveDebug")}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("webhooks.actions.more")}
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-36"
                            >
                              <DropdownMenuItem
                                onClick={() => onViewLogs(webhook)}
                              >
                                {t("webhooks.actions.viewLogs")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => onRemove(webhook)}
                              >
                                {t("webhooks.actions.remove")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
