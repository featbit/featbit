import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { renderAlertPayload, type AlertEvent } from "./alert-payload"
import { DEFAULT_ALERT_SAMPLE } from "./alert-contract-samples"
import { ALERT_EVENT_CATALOG } from "./alert-event-catalog"
import { AlertSamplePicker } from "./alert-sample-picker"

export function PayloadPreviewDialog({
  template,
  onClose,
}: {
  template: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [event, setEvent] = useState<AlertEvent>("alert.triggered")
  const [sample, setSample] = useState(DEFAULT_ALERT_SAMPLE)
  const [copied, setCopied] = useState(false)
  let payload = ""
  let error = ""
  try {
    payload = renderAlertPayload(template, event, sample)
  } catch (caught) {
    error =
      caught instanceof Error
        ? caught.message
        : t("webhooks.validation.templateInvalid")
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("webhooks.releaseHealth.previewTitle")}</DialogTitle>
          <DialogDescription>
            {t("webhooks.releaseHealth.sampleHelp")}
          </DialogDescription>
        </DialogHeader>
        <AlertSamplePicker
          value={sample}
          onChange={(next) => {
            setSample(next)
            setCopied(false)
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={event}
            onValueChange={(value) => {
              setEvent(value as AlertEvent)
              setCopied(false)
            }}
          >
            <TabsList className="h-auto">
              {ALERT_EVENT_CATALOG.map((item) => (
                <TabsTrigger
                  key={item.type}
                  value={item.type}
                  className="h-auto py-2"
                  aria-label={t(`webhooks.releaseHealth.${item.label}`)}
                >
                  <span className="flex flex-col gap-0.5">
                    <span>{t(`webhooks.releaseHealth.${item.label}`)}</span>
                    <code className="text-[10px] font-normal">{item.type}</code>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(error)}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(payload)
                setCopied(true)
              } catch {
                toast.error(t("webhooks.releaseHealth.copyFailed"))
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
            {t(copied ? "webhooks.releaseHealth.copied" : "webhooks.copy")}
          </Button>
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive p-4 text-sm text-destructive"
          >
            {error}
          </p>
        ) : (
          <pre
            aria-label={t("webhooks.releaseHealth.renderedPayload")}
            className="min-h-0 overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-6"
          >
            <code>{payload}</code>
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}
