import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, ChevronUp, Save } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { metricSampleText, ruleSampleText } from "../release-health-display"
import { checkoutMonitor, releaseMetrics } from "../release-health-mock-data"
import type { MonitorPurpose } from "../release-health-types"
import { DataStatusBadge, PurposeBadge } from "./status-badges"

const schema = z.object({
  warmup: z.string(),
  lookback: z.string(),
  evaluation: z.string(),
  sustain: z.string(),
})

type ConfigurationValues = z.infer<typeof schema>

const defaultValues: ConfigurationValues = {
  warmup: "5m",
  lookback: "10m",
  evaluation: "1m",
  sustain: "5m",
}

export function MonitorConfigurationSheet({
  open,
  monitoringEnabled,
  flagName,
  flagKey,
  environmentName,
  onOpenChange,
  onComplete,
}: {
  open: boolean
  monitoringEnabled: boolean
  flagName: string
  flagKey: string
  environmentName: string
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}) {
  const { t } = useTranslation()
  const [selectedMetricIds, setSelectedMetricIds] = useState(() =>
    checkoutMonitor.bindings.map((binding) => binding.metricId)
  )
  const [purposes, setPurposes] = useState<Record<string, MonitorPurpose>>(() =>
    Object.fromEntries(
      checkoutMonitor.bindings.map((binding) => [
        binding.metricId,
        binding.purpose,
      ])
    )
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { control, reset, handleSubmit } = useForm<ConfigurationValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const configuration = useWatch({ control, defaultValue: defaultValues })
  const selectedGuardCount = selectedMetricIds.filter(
    (metricId) => purposes[metricId] === "guard"
  ).length

  function setOpen(next: boolean) {
    onOpenChange(next)
    if (!next) {
      reset(defaultValues)
      setShowAdvanced(false)
    }
  }

  function submit() {
    toast.success(t("releaseHealth.monitor.savedPreview"))
    onComplete?.()
    setOpen(false)
  }

  function toggleMetric(metricId: string, selected: boolean) {
    setSelectedMetricIds((current) =>
      selected
        ? [...new Set([...current, metricId])]
        : current.filter((id) => id !== metricId)
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-[calc(100%-1rem)] data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b px-4 py-5 sm:px-6">
          <SheetTitle>{t("releaseHealth.monitor.title")}</SheetTitle>
          <SheetDescription>
            {t("releaseHealth.monitor.description")}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => void handleSubmit(submit)(event)}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="rounded-md border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{flagName}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {flagKey}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{environmentName}</Badge>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {t("releaseHealth.monitor.monitoringStatus")}
                </span>
                <Badge variant="outline">
                  {t(
                    monitoringEnabled
                      ? "releaseHealth.flag.monitoring"
                      : "releaseHealth.flag.paused"
                  )}
                </Badge>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {t("releaseHealth.monitor.automaticHelp")}
              </p>
            </section>

            <section className="space-y-3">
              <SectionHeading
                title={t("releaseHealth.monitor.metricsTitle")}
                description={t("releaseHealth.monitor.metricsDescription")}
              />
              <div className="space-y-2">
                {releaseMetrics.slice(0, 4).map((metric) => {
                  const selected = selectedMetricIds.includes(metric.id)
                  const purpose = purposes[metric.id] ?? "observe"
                  return (
                    <div
                      key={metric.id}
                      className={cn(
                        "rounded-md border p-3",
                        selected && "border-foreground/25 bg-muted/20"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selected}
                          aria-label={metricSampleText(t, metric, "name")}
                          onCheckedChange={(checked) =>
                            toggleMetric(metric.id, Boolean(checked))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                {metricSampleText(t, metric, "name")}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {metric.key} · v{metric.version}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <DataStatusBadge
                                status={metric.environment.dataStatus}
                              />
                              <Badge variant="outline">
                                {t("releaseHealth.scope.environment")}
                              </Badge>
                            </div>
                          </div>
                          {selected ? (
                            <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[minmax(12rem,1fr)_auto] sm:items-end">
                              <div className="space-y-1.5">
                                <Label htmlFor={`metric-context-${metric.id}`}>
                                  {t("releaseHealth.monitor.observation")}
                                </Label>
                                <div
                                  id={`metric-context-${metric.id}`}
                                  className="flex min-h-10 items-center rounded-md border bg-muted/20 px-3 text-sm"
                                >
                                  {t("releaseHealth.scope.environment")}
                                </div>
                                <p className="text-xs leading-5 text-muted-foreground">
                                  {t(
                                    "releaseHealth.monitor.wholeEnvironmentHelp"
                                  )}
                                </p>
                              </div>
                              <div className="inline-flex rounded-md border bg-background p-0.5">
                                {(["observe", "guard"] as const).map(
                                  (value) => (
                                    <Button
                                      key={value}
                                      type="button"
                                      size="sm"
                                      variant={
                                        purpose === value
                                          ? "secondary"
                                          : "ghost"
                                      }
                                      className="h-7 rounded-sm px-3 text-xs"
                                      onClick={() =>
                                        setPurposes((current) => ({
                                          ...current,
                                          [metric.id]: value,
                                        }))
                                      }
                                    >
                                      {t(`releaseHealth.purpose.${value}`)}
                                    </Button>
                                  )
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                                <PurposeBadge purpose={purpose} />
                                {purpose === "guard"
                                  ? ruleSampleText(
                                      t,
                                      metric.id === "metric-api-latency"
                                        ? "> 800 ms for 10 min"
                                        : metric.id === "metric-error-rate"
                                          ? "> 2% for 5 min"
                                          : "> 85% for 10 min"
                                    )
                                  : t("releaseHealth.monitor.trendOnly")}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-md border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("releaseHealth.monitor.advancedTitle")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("releaseHealth.monitor.advancedSummary", {
                      warmup: configuration.warmup,
                      lookback: configuration.lookback,
                      guards: selectedGuardCount,
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced((current) => !current)}
                >
                  {showAdvanced ? <ChevronUp /> : <ChevronDown />}
                  {t(
                    showAdvanced
                      ? "releaseHealth.monitor.hideAdvanced"
                      : "releaseHealth.monitor.showAdvanced"
                  )}
                </Button>
              </div>
            </section>

            {showAdvanced ? (
              <div className="space-y-6 rounded-md border border-dashed p-4 sm:p-5">
                <section className="space-y-3">
                  <SectionHeading
                    title={t("releaseHealth.monitor.windowTitle")}
                    description={t("releaseHealth.monitor.windowDescription")}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SelectField
                      control={control}
                      name="warmup"
                      label={t("releaseHealth.monitor.warmup")}
                      options={["0m", "5m", "10m", "15m"]}
                    />
                    <SelectField
                      control={control}
                      name="lookback"
                      label={t("releaseHealth.monitor.lookback")}
                      options={["5m", "10m", "15m", "30m"]}
                    />
                    <SelectField
                      control={control}
                      name="evaluation"
                      label={t("releaseHealth.monitor.evaluation")}
                      options={["1m", "2m", "5m"]}
                    />
                    <SelectField
                      control={control}
                      name="sustain"
                      label={t("releaseHealth.monitor.sustain")}
                      options={["1m", "5m", "10m"]}
                    />
                  </div>
                </section>
              </div>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end border-t px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("releaseHealth.common.cancel")}
            </Button>
            <Button type="submit" disabled={selectedMetricIds.length === 0}>
              <Save />
              {t("releaseHealth.monitor.save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function SelectField<
  TName extends "warmup" | "lookback" | "evaluation" | "sustain",
>({
  control,
  name,
  label,
  options,
}: {
  control: ReturnType<typeof useForm<ConfigurationValues>>["control"]
  name: TName
  label: string
  options: ConfigurationValues[TName][]
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(value) => value && field.onChange(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{field.value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
    </div>
  )
}
