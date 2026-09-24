import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { formatMetricValue } from "../metrics/metric-contract"
import type { MonitorBinding } from "../release-health-types"
import type { BindingMetric } from "./monitor-data"
import type { BindingWebhook } from "./binding-webhooks"

export function BindingActions({
  binding,
  metricName,
  onEdit,
  onToggle,
  onRemove,
  disabled,
}: {
  disabled: boolean
  binding: MonitorBinding
  metricName: string
  onEdit: () => void
  onToggle: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const label = (key: string) =>
    t("releaseHealth.binding." + key, { metric: metricName })
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        disabled={disabled}
        variant="ghost"
        size="icon-sm"
        aria-label={label("editFor")}
        title={label("edit")}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        disabled={disabled}
        variant="ghost"
        size="icon-sm"
        aria-label={label(binding.enabled ? "pauseFor" : "resumeFor")}
        title={label(binding.enabled ? "pause" : "resume")}
        onClick={onToggle}
      >
        {binding.enabled ? <Pause /> : <Play />}
      </Button>
      <Button
        disabled={disabled}
        variant="ghost"
        size="icon-sm"
        aria-label={label("removeFor")}
        title={label("remove")}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

export function BindingRuleSummary({
  binding,
  metric,
  webhooks,
}: {
  binding: MonitorBinding
  metric: BindingMetric
  webhooks: BindingWebhook[]
}) {
  const { t } = useTranslation()
  if (binding.purpose === "trend")
    return <span>{t("releaseHealth.binding.trendOnly")}</span>
  return (
    <div className="space-y-4">
      {binding.rules.map((rule) => (
        <div key={rule.id} className="space-y-1">
          <p className="font-medium">{rule.name}</p>
          <p>
            {t("releaseHealth.samples.ruleForMinutes", {
              condition:
                rule.operator + " " + formatMetricValue(metric, rule.threshold),
              count: rule.sustain,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("releaseHealth.binding.ruleSummary", {
              reducer: t("releaseHealth.binding." + rule.reducer),
              lookback: rule.lookback,
              recovery: rule.recovery,
              severity: t("releaseHealth.binding." + rule.severity),
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("releaseHealth.binding.webhook")}:{" "}
            {webhooks.find((item) => item.id === rule.webhookId)?.name ??
              t(
                rule.webhookId
                  ? "releaseHealth.binding.webhookUnavailableShort"
                  : "releaseHealth.binding.webhookNotSelected"
              )}
          </p>
        </div>
      ))}
    </div>
  )
}
