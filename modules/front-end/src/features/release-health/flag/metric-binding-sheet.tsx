import { zodResolver } from "@hookform/resolvers/zod"
import { Save } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Lang } from "@/features/layout/layout-types"
import { DataStatusBadge } from "../components/status-badges"
import { metricUnitLabel } from "../metrics/metric-contract"
import { metricSampleText } from "../release-health-display"
import type { MonitorBinding, ReleaseMetric } from "../release-health-types"
import {
  bindingDefaults,
  bindingFromForm,
  bindingSchema,
  type BindingFormValues,
} from "./binding-form"
import { BindingSelect } from "./binding-rule-fields"
import { BindingAlertRules } from "./binding-alert-rules"
import { BindingConfirmation } from "./binding-confirmation"
import type { useBindingWebhooks } from "./binding-webhooks"

export function MetricBindingSheet({
  binding,
  bindings,
  metrics,
  monitoringEnabled,
  flagName,
  flagKey,
  environmentName,
  projectId,
  envId,
  lang,
  webhooks,
  onClose,
  onSave,
}: {
  binding?: MonitorBinding
  bindings: MonitorBinding[]
  metrics: ReleaseMetric[]
  monitoringEnabled: boolean
  flagName: string
  flagKey: string
  environmentName: string
  projectId: string
  envId: string
  lang: Lang
  webhooks: ReturnType<typeof useBindingWebhooks>
  onClose: () => void
  onSave: (binding: MonitorBinding) => void
}) {
  const { t } = useTranslation()
  const b = (key: string) => t("releaseHealth.binding." + key)
  const available = binding
    ? metrics.filter((item) => item.id === binding.metricId)
    : metrics.filter(
        (item) => !bindings.some((entry) => entry.metricId === item.id)
      )
  const [discardOpen, setDiscardOpen] = useState(false)
  const form = useForm<BindingFormValues>({
    resolver: zodResolver(
      bindingSchema(
        t,
        metrics,
        available.map((item) => item.id)
      )
    ),
    defaultValues: bindingDefaults(
      binding,
      t("releaseHealth.binding.ruleNumber", { count: 1 })
    ),
  })
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = form
  const values = useWatch({ control })
  const selected = metrics.find((item) => item.id === values.metricId)
  const paused = !monitoringEnabled || binding?.enabled === false
  const close = () => {
    if (!isSubmitting) {
      if (isDirty) setDiscardOpen(true)
      else onClose()
    }
  }

  async function submit(values: BindingFormValues) {
    if (values.purpose === "guard") {
      const latest = await webhooks.refetch()
      let unavailable = false
      values.rules.forEach((rule, index) => {
        if (
          latest.isError ||
          !latest.data?.some((hook) => hook.id === rule.webhookId)
        ) {
          setError(`rules.${index}.webhookId`, {
            message: b("webhookUnavailable"),
          })
          unavailable = true
        }
      })
      if (unavailable) return
    }
    onSave(bindingFromForm(values, binding))
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && close()}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-[calc(100%-1rem)] data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="border-b px-4 py-5 sm:px-6">
            <SheetTitle>{b(binding ? "edit" : "add")}</SheetTitle>
            <SheetDescription>{b("description")}</SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => void handleSubmit(submit)(event)}
            noValidate
          >
            <fieldset
              disabled={isSubmitting}
              className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6"
            >
              <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">{flagName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {flagKey}
                  </p>
                </div>
                <Badge variant="outline">{environmentName}</Badge>
              </div>
              {paused && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  {b("pausedHelp")}
                </p>
              )}
              <section className="space-y-3">
                <Controller
                  control={control}
                  name="metricId"
                  render={({ field }) => (
                    <BindingSelect
                      id="binding-metric"
                      label={b("metric")}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={Boolean(binding)}
                      placeholder={b("selectMetric")}
                      invalid={Boolean(errors.metricId)}
                      options={available.map((metric) => ({
                        value: metric.id,
                        label:
                          metricSampleText(t, metric, "name") +
                          " · v" +
                          metric.version,
                        disabled: !metric.environment.sourceBinding,
                      }))}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {b(
                    binding
                      ? "metricLocked"
                      : available.length
                        ? "metricHelp"
                        : "noMetrics"
                  )}
                </p>
                {errors.metricId && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.metricId.message}
                  </p>
                )}
                {selected && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <code>{selected.key}</code>
                    <Badge variant="outline">
                      {t("releaseHealth.scope.environment")}
                    </Badge>
                    <DataStatusBadge status={selected.environment.dataStatus} />
                  </div>
                )}
              </section>
              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">{b("use")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["trend", "guard"] as const).map((purpose) => (
                    <label
                      key={purpose}
                      className={
                        "flex cursor-pointer items-start gap-3 rounded-md border p-4 " +
                        (values.purpose === purpose
                          ? "border-foreground/50 bg-muted/30"
                          : "")
                      }
                    >
                      <input
                        type="radio"
                        className="mt-1 accent-foreground"
                        value={purpose}
                        checked={values.purpose === purpose}
                        {...register("purpose")}
                        onChange={() =>
                          setValue("purpose", purpose, { shouldDirty: true })
                        }
                      />
                      <span>
                        <span className="text-sm font-medium">
                          {t("releaseHealth.purpose." + purpose)}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {b(purpose + "Help")}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {values.purpose === "guard" && (
                <BindingAlertRules
                  form={form}
                  unit={
                    selected
                      ? metricUnitLabel(t, selected.resultContract.unit)
                      : b("metricUnit")
                  }
                  webhooks={webhooks}
                  projectId={projectId}
                  envId={envId}
                  lang={lang}
                />
              )}
            </fieldset>
            <SheetFooter className="border-t px-4 py-4 sm:px-6">
              <p className="mb-2 text-xs text-muted-foreground">
                {b("previewNotice")}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={close}
                >
                  {t("releaseHealth.common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !available.length ||
                    (values.purpose === "guard" && webhooks.isFetching)
                  }
                >
                  <Save />
                  {b(isSubmitting ? "saving" : binding ? "save" : "add")}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <BindingConfirmation
        open={discardOpen}
        title={b("discardTitle")}
        description={b("discardDescription")}
        confirm={b("discard")}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={onClose}
      />
    </>
  )
}
