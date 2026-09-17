import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  rateNumerators,
  ratePeriods,
} from "@/features/release-health/metrics/metric-contract"
import {
  ALERT_PROFILES,
  alertProfileLabel,
  alertSampleProfile,
  alertSampleUnit,
  canonicalUnitLabel,
  type AlertSampleOptions,
} from "./alert-contract-samples"

export function AlertSamplePicker({
  value,
  onChange,
}: {
  value: AlertSampleOptions
  onChange: (value: AlertSampleOptions) => void
}) {
  const { t } = useTranslation()
  const h = (key: string) => t(`webhooks.releaseHealth.${key}`)
  const profile = alertSampleProfile(value)
  const fields = [
    {
      key: "profileId" as const,
      label: h("sampleProfile"),
      options: ALERT_PROFILES.map((item) => ({
        value: item.id,
        label: alertProfileLabel(t, item),
      })),
    },
    {
      key: "severity" as const,
      label: h("sampleSeverity"),
      options: ["warning", "critical"].map((item) => ({
        value: item,
        label: h(item),
      })),
    },
    ...(profile.unitKind === "rate"
      ? [
          {
            key: "rateNumerator" as const,
            label: h("rateNumerator"),
            options: rateNumerators.map((item) => ({
              value: item,
              label: t(`releaseHealth.resultContract.rateNumerator.${item}`),
            })),
          },
          {
            key: "ratePeriod" as const,
            label: h("ratePeriod"),
            options: ratePeriods.map((item) => ({
              value: item,
              label: t(`releaseHealth.resultContract.ratePeriod.${item}`),
            })),
          },
        ]
      : []),
  ]
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium">{field.label}</p>
            <Select
              value={value[field.key]}
              onValueChange={(next) => {
                if (
                  next &&
                  field.options.some((option) => option.value === next)
                )
                  onChange({ ...value, [field.key]: next })
              }}
            >
              <SelectTrigger aria-label={field.label} className="w-full">
                <SelectValue>
                  {
                    field.options.find(
                      (option) => option.value === value[field.key]
                    )?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {t("releaseHealth.resultContract.singleSeries")} · {h("canonicalUnit")}:{" "}
        {canonicalUnitLabel(alertSampleUnit(value))}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {h("sampleProfileHelp")}
      </p>
    </div>
  )
}
