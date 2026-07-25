import {
  CheckCircle2,
  CircleAlert,
  Clock,
  LoaderCircle,
  RefreshCw,
  Send,
  X,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DEFAULT_TEST_EVENT, WEBHOOK_EVENTS } from "../webhook-events"
import { sendTestWebhook } from "../webhooks-api"
import type { WebhookDelivery, WebhookHeader } from "../webhook-types"
import { formatDuration, newId, renderTestPayload } from "../webhook-utils"
import { DeliveryDetail } from "./delivery-detail"

export type DebugConfiguration = {
  id: string
  name: string
  url: string
  secret: string
  headers: WebhookHeader[]
  events: string[]
  payloadTemplate: string
  preventEmptyPayloads: boolean
}

function initialDebugEvent(events: string[]) {
  return events.includes(DEFAULT_TEST_EVENT)
    ? DEFAULT_TEST_EVENT
    : (events[0] ?? DEFAULT_TEST_EVENT)
}

export function LiveDebugDialog({
  open,
  webhook,
  onOpenChange,
}: {
  open: boolean
  webhook: DebugConfiguration | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const availableEvents = WEBHOOK_EVENTS.filter((item) =>
    webhook?.events.includes(item.value)
  )
  const [event, setEvent] = useState(() =>
    initialDebugEvent(webhook?.events ?? [])
  )
  const [delivery, setDelivery] = useState<WebhookDelivery | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const close = useCallback(() => {
    if (sending) return
    setEvent(initialDebugEvent(webhook?.events ?? []))
    setDelivery(null)
    setError("")
    onOpenChange(false)
  }, [onOpenChange, sending, webhook?.events])

  useEffect(() => {
    if (!open || sending) return
    function onKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") {
        keyEvent.preventDefault()
        close()
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [close, open, sending])

  async function send() {
    if (!webhook) return
    setSending(true)
    setError("")
    try {
      const payload = renderTestPayload(event, webhook.payloadTemplate)
      const result = await sendTestWebhook({
        id: webhook.id,
        deliveryId: newId(),
        url: webhook.url,
        name: webhook.name,
        secret: webhook.secret,
        headers: webhook.headers.filter((header) => header.key),
        events: event,
        payload,
        preventEmptyPayloads: webhook.preventEmptyPayloads,
      })
      setDelivery(result)
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : t("webhooks.debug.sendFailed")
      )
    } finally {
      setSending(false)
    }
  }

  const status = delivery?.response
    ? `${delivery.response.statusCode}${
        delivery.response.reasonPhrase
          ? ` ${delivery.response.reasonPhrase}`
          : ""
      }`
    : "ERROR"
  const ignored = delivery?.webhookId === "00000000-0000-0000-0000-000000000000"
  const selectedEvent = WEBHOOK_EVENTS.find((item) => item.value === event)

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(760px,calc(100vh-48px))] w-[min(760px,calc(100vw-40px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]"
      >
        <DialogHeader className="px-6 pt-5 pr-14 pb-3">
          <DialogTitle className="text-lg">
            {t("webhooks.debug.title")}
          </DialogTitle>
          <DialogDescription>
            <Trans
              i18nKey="webhooks.debug.description"
              values={{ name: webhook?.name ?? "" }}
              components={{
                webhookName: <span className="font-medium text-foreground" />,
              }}
            />
          </DialogDescription>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4"
            disabled={sending}
            aria-label={t("webhooks.close")}
            onClick={close}
          >
            <X />
          </Button>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
          <div className="flex h-9 min-w-0 items-center rounded-lg border bg-muted/20 px-3">
            <span className="w-32 shrink-0 text-xs text-muted-foreground">
              {t("webhooks.debug.endpoint")}
            </span>
            <TooltipProvider delay={300}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <code className="block min-w-0 flex-1 truncate text-xs" />
                  }
                >
                  {webhook?.url}
                </TooltipTrigger>
                <TooltipContent className="max-w-[min(36rem,calc(100vw-2rem))] font-mono break-all">
                  {webhook?.url}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="webhook-debug-event">
              {t("webhooks.debug.event")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={event}
              disabled={sending}
              onValueChange={(value) => value && setEvent(value)}
            >
              <SelectTrigger id="webhook-debug-event" className="w-full">
                <SelectValue>
                  <span>
                    {selectedEvent
                      ? t(`webhooks.events.${selectedEvent.labelKey}`)
                      : event}
                  </span>
                  <code className="text-xs text-muted-foreground">{event}</code>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["featureFlag", "segment"] as const).map((group) => {
                  const groupEvents = availableEvents.filter(
                    (item) => item.group === group
                  )
                  return groupEvents.length ? (
                    <SelectGroup key={group}>
                      <SelectLabel>
                        {t(`webhooks.eventGroups.${group}`)}
                      </SelectLabel>
                      {groupEvents.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          <span className="flex flex-col">
                            <span>{t(`webhooks.events.${item.labelKey}`)}</span>
                            <code className="text-xs text-muted-foreground">
                              {item.value}
                            </code>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null
                })}
              </SelectContent>
            </Select>
          </div>

          {sending ? (
            <div className="mt-5 space-y-3 border-t pt-5">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-32 animate-pulse rounded-md bg-muted" />
            </div>
          ) : delivery ? (
            <div className="mt-5 border-t pt-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {ignored ? (
                  <CircleAlert className="size-5 text-amber-600" />
                ) : delivery.success ? (
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CircleAlert className="size-5 text-destructive" />
                )}
                <span className="font-medium">
                  {t(
                    ignored
                      ? "webhooks.debug.notSent"
                      : delivery.success
                        ? "webhooks.debug.delivered"
                        : "webhooks.debug.failed"
                  )}
                </span>
                <Badge
                  variant="outline"
                  className={
                    ignored
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                      : delivery.success
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : "border-destructive/40 text-destructive"
                  }
                >
                  {status}
                </Badge>
                {delivery.startedAt && delivery.endedAt ? (
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {t("webhooks.delivery.completedIn", {
                      duration: formatDuration(
                        delivery.startedAt,
                        delivery.endedAt
                      ),
                    })}
                  </span>
                ) : null}
              </div>
              <DeliveryDetail
                delivery={delivery}
                className="border-t-0 bg-transparent px-0 py-0"
                showDuration={false}
              />
            </div>
          ) : error ? (
            <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="m-0 rounded-none border-t-0 bg-transparent px-6 py-4 sm:items-center">
          <span className="mr-auto max-w-md text-xs text-muted-foreground">
            {t("webhooks.debug.warning")}
          </span>
          <Button variant="outline" disabled={sending} onClick={close}>
            {t("webhooks.close")}
          </Button>
          <Button disabled={sending} onClick={() => void send()}>
            {sending ? (
              <LoaderCircle className="animate-spin" />
            ) : delivery ? (
              <RefreshCw />
            ) : (
              <Send />
            )}
            {t(
              sending
                ? "webhooks.debug.sending"
                : delivery
                  ? "webhooks.debug.sendAgain"
                  : "webhooks.debug.send"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
