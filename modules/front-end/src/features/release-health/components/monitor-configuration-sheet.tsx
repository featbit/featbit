import { zodResolver } from "@hookform/resolvers/zod"
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  CirclePause,
  Info,
  LockKeyhole,
  Play,
  Save,
  ShieldCheck,
  Webhook,
} from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { metricSampleText, ruleSampleText } from "../release-health-display"
import { releaseMetrics } from "../release-health-mock-data"
import type { MonitorPurpose } from "../release-health-types"
import { DataStatusBadge, PurposeBadge } from "./status-badges"

const schema = z.object({
  warmup: z.string(),
  lookback: z.string(),
  evaluation: z.string(),
  sustain: z.string(),
  noDataPolicy: z.enum(["wait", "notify", "block"]),
  continuous: z.boolean(),
  flagChanges: z.boolean(),
  alerts: z.boolean(),
  webhook: z.boolean(),
  requireApproval: z.boolean(),
  pause: z.boolean(),
})

type ConfigurationValues = z.infer<typeof schema>
type SetupVariant = "monitor" | "quick" | "change"

const defaultValues: ConfigurationValues = {
  warmup: "5m",
  lookback: "10m",
  evaluation: "1m",
  sustain: "5m",
  noDataPolicy: "wait",
  continuous: true,
  flagChanges: true,
  alerts: true,
  webhook: true,
  requireApproval: true,
  pause: false,
}

export function MonitorConfigurationSheet({
  open,
  variant,
  flagName,
  flagKey,
  environmentName,
  revision,
  onOpenChange,
  onComplete,
}: {
  open: boolean
  variant: SetupVariant
  flagName: string
  flagKey: string
  environmentName: string
  revision?: string
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}) {
  const { t } = useTranslation()
  const [changeSetup, setChangeSetup] = useState<"existing" | "quick">(
    "existing"
  )
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([
    "metric-error-rate",
    "metric-api-latency",
    "metric-completion",
  ])
  const [purposes, setPurposes] = useState<Record<string, MonitorPurpose>>({
    "metric-error-rate": "guard",
    "metric-api-latency": "guard",
    "metric-completion": "observe",
    "metric-memory": "guard",
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { control, reset, handleSubmit } = useForm<ConfigurationValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const configuration = useWatch({ control, defaultValue: defaultValues })
  const usesExisting = variant === "change" && changeSetup === "existing"
  const selectedGuardCount = selectedMetricIds.filter(
    (metricId) => purposes[metricId] === "guard"
  ).length
  const configuredActionCount = [
    configuration.alerts,
    configuration.webhook,
    configuration.pause,
    configuration.requireApproval,
  ].filter(Boolean).length

  function setOpen(next: boolean) {
    onOpenChange(next)
    if (!next) {
      reset(defaultValues)
      setChangeSetup("existing")
      setShowAdvanced(false)
    }
  }

  function submit() {
    toast.success(
      t(
        variant === "monitor"
          ? "releaseHealth.monitor.savedPreview"
          : "releaseHealth.monitor.startedPreview"
      )
    )
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
          <SheetTitle>
            {t(`releaseHealth.monitor.titles.${variant}`)}
          </SheetTitle>
          <SheetDescription>
            {t(`releaseHealth.monitor.descriptions.${variant}`)}
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
                  {revision ? (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {revision}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            {variant === "change" ? (
              <section className="space-y-3">
                <SectionHeading
                  title={t("releaseHealth.monitor.changeAssociation")}
                  description={t("releaseHealth.monitor.changeAssociationHelp")}
                />
                <RadioGroup
                  value={changeSetup}
                  onValueChange={(value) =>
                    setChangeSetup(value as "existing" | "quick")
                  }
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <RadioChoice
                    value="existing"
                    title={t("releaseHealth.monitor.useExisting")}
                    description={t("releaseHealth.monitor.useExistingHelp")}
                  />
                  <RadioChoice
                    value="quick"
                    title={t("releaseHealth.monitor.quickConfig")}
                    description={t("releaseHealth.monitor.quickConfigHelp")}
                  />
                </RadioGroup>
                {usesExisting ? (
                  <div className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {t("releaseHealth.flag.monitorName", {
                            flag: flagName,
                          })}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("releaseHealth.monitor.existingSummary", {
                            guardCount: 3,
                            observeCount: 1,
                          })}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {t("releaseHealth.monitor.snapshotAtApply")}
                      </Badge>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {!usesExisting ? (
              <>
                {variant === "monitor" ? (
                  <section className="space-y-3">
                    <SectionHeading
                      title={t("releaseHealth.monitor.whenTitle")}
                      description={t("releaseHealth.monitor.whenDescription")}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SwitchField
                        control={control}
                        name="continuous"
                        label={t("releaseHealth.monitor.continuous")}
                        help={t("releaseHealth.monitor.continuousHelp")}
                      />
                      <SwitchField
                        control={control}
                        name="flagChanges"
                        label={t("releaseHealth.monitor.flagChanges")}
                        help={t("releaseHealth.monitor.flagChangesHelp")}
                      />
                    </div>
                  </section>
                ) : null}

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
                                    <Label
                                      htmlFor={`metric-context-${metric.id}`}
                                    >
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
                          actions: configuredActionCount,
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
                        description={t(
                          "releaseHealth.monitor.windowDescription"
                        )}
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

                    <section className="space-y-3">
                      <SectionHeading
                        title={t("releaseHealth.monitor.gateTitle")}
                        description={t("releaseHealth.monitor.gateDescription")}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-md border p-4">
                          <Label className="text-sm">
                            {t("releaseHealth.monitor.combination")}
                          </Label>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("releaseHealth.monitor.allRequired")}
                          </p>
                        </div>
                        <SelectField
                          control={control}
                          name="noDataPolicy"
                          label={t("releaseHealth.monitor.noDataPolicy")}
                          options={["wait", "notify", "block"]}
                          translateOptions
                        />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <SectionHeading
                        title={t("releaseHealth.monitor.actionsTitle")}
                        description={t(
                          "releaseHealth.monitor.actionsDescription"
                        )}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ActionSwitch
                          control={control}
                          name="alerts"
                          icon={BellRing}
                          label={t("releaseHealth.monitor.alertOwners")}
                          help={t("releaseHealth.monitor.alertOwnersHelp")}
                        />
                        <ActionSwitch
                          control={control}
                          name="webhook"
                          icon={Webhook}
                          label={t("releaseHealth.monitor.richWebhook")}
                          help={t("releaseHealth.monitor.richWebhookHelp")}
                        />
                        <ActionSwitch
                          control={control}
                          name="pause"
                          icon={CirclePause}
                          label={t("releaseHealth.monitor.pause")}
                          help={t("releaseHealth.monitor.pauseHelp")}
                        />
                        <ActionSwitch
                          control={control}
                          name="requireApproval"
                          icon={ShieldCheck}
                          label={t("releaseHealth.monitor.requireApproval")}
                          help={t("releaseHealth.monitor.requireApprovalHelp")}
                        />
                        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-4 opacity-70 sm:col-span-2">
                          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">
                                {t("releaseHealth.monitor.autoRollback")}
                              </p>
                              <Badge variant="outline">
                                {t("releaseHealth.monitor.notInMvp")}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {t("releaseHealth.monitor.autoRollbackHelp")}
                            </p>
                          </div>
                          <Switch disabled />
                        </div>
                      </div>
                    </section>
                  </div>
                ) : null}

                <Alert>
                  <Info />
                  <AlertDescription>
                    {t("releaseHealth.monitor.snapshotNotice")}
                  </AlertDescription>
                </Alert>
              </>
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
            <Button
              type="submit"
              disabled={!usesExisting && selectedMetricIds.length === 0}
            >
              {variant === "monitor" ? <Save /> : <Play />}
              {t(`releaseHealth.monitor.submit.${variant}`)}
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

function RadioChoice({
  value,
  title,
  description,
}: {
  value: string
  title: string
  description: string
}) {
  return (
    <Label className="flex cursor-pointer items-start gap-3 rounded-md border p-4 font-normal has-[[data-checked]]:border-foreground/30 has-[[data-checked]]:bg-muted/30">
      <RadioGroupItem value={value} />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </Label>
  )
}

function SwitchField({
  control,
  name,
  label,
  help,
}: {
  control: ReturnType<typeof useForm<ConfigurationValues>>["control"]
  name: "continuous" | "flagChanges"
  label: string
  help: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start justify-between gap-3 rounded-md border p-4">
          <div>
            <Label className="text-sm">{label}</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {help}
            </p>
          </div>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  )
}

function ActionSwitch({
  control,
  name,
  icon: Icon,
  label,
  help,
}: {
  control: ReturnType<typeof useForm<ConfigurationValues>>["control"]
  name: "alerts" | "webhook" | "requireApproval" | "pause"
  icon: typeof BellRing
  label: string
  help: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start gap-3 rounded-md border p-4">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <Label className="text-sm">{label}</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {help}
            </p>
          </div>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  )
}

function SelectField<
  TName extends
    "warmup" | "lookback" | "evaluation" | "sustain" | "noDataPolicy",
>({
  control,
  name,
  label,
  options,
  translateOptions = false,
}: {
  control: ReturnType<typeof useForm<ConfigurationValues>>["control"]
  name: TName
  label: string
  options: ConfigurationValues[TName][]
  translateOptions?: boolean
}) {
  const { t } = useTranslation()
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
              <SelectValue>
                {translateOptions
                  ? t(`releaseHealth.monitor.noDataOptions.${field.value}`)
                  : field.value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {translateOptions
                      ? t(`releaseHealth.monitor.noDataOptions.${option}`)
                      : option}
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
