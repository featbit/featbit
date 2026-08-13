import { Clock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { WebhookDelivery } from "../webhook-types"
import { formatDuration, headersToText, tryFormatJson } from "../webhook-utils"
import { CodePanel } from "./code-panel"

function DetailSection({
  title,
  value,
  empty,
}: {
  title: string
  value: string
  empty: string
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {value ? (
        <CodePanel value={value} />
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

export function DeliveryDetail({
  delivery,
  className,
  showDuration = true,
}: {
  delivery: WebhookDelivery
  className?: string
  showDuration?: boolean
}) {
  const { t } = useTranslation()
  const requestHeaders = delivery.request
    ? [
        `Request URL: ${delivery.request.url}`,
        "Request method: POST",
        "Accept: */*",
        "Content-Type: application/json",
        headersToText(delivery.request.headers),
      ]
        .filter(Boolean)
        .join("\n")
    : ""
  const responseStatus = delivery.response?.statusCode ?? "ERROR"
  return (
    <div className={cn("border-t bg-muted/20 px-5 py-4", className)}>
      <Tabs defaultValue="request">
        <div className="flex items-center justify-between gap-4 border-b">
          <TabsList variant="line">
            <TabsTrigger value="request">
              {t("webhooks.delivery.request")}
            </TabsTrigger>
            <TabsTrigger value="response">
              {t("webhooks.delivery.response", { status: responseStatus })}
            </TabsTrigger>
          </TabsList>
          {showDuration ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {t("webhooks.delivery.completedIn", {
                duration: formatDuration(delivery.startedAt, delivery.endedAt),
              })}
            </span>
          ) : null}
        </div>
        <TabsContent value="request" className="mt-4 space-y-4">
          <DetailSection
            title={t("webhooks.delivery.headers")}
            value={requestHeaders}
            empty={t("webhooks.delivery.noRequestHeaders")}
          />
          <DetailSection
            title={t("webhooks.delivery.payload")}
            value={tryFormatJson(delivery.request?.payload)}
            empty={t("webhooks.delivery.emptyPayload")}
          />
        </TabsContent>
        <TabsContent value="response" className="mt-4 space-y-4">
          {delivery.error?.message ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {delivery.error.message}
            </p>
          ) : null}
          <DetailSection
            title={t("webhooks.delivery.headers")}
            value={headersToText(delivery.response?.headers)}
            empty={t("webhooks.delivery.noResponseHeaders")}
          />
          <DetailSection
            title={t("webhooks.delivery.body")}
            value={tryFormatJson(delivery.response?.body)}
            empty={t("webhooks.delivery.emptyResponseBody")}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
