import { zodResolver } from "@hookform/resolvers/zod"
import { Info, Loader2, Lock } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Textarea } from "@/components/ui/textarea"
import type {
  Metric,
  MetricAggregation,
  MetricCreatePayload,
  MetricType,
  MetricUpdatePayload,
} from "../metrics-types"
import { normalizeMetricKey } from "../metrics-utils"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "releaseDecision.metrics.form.nameRequired")
    .max(256, "releaseDecision.metrics.form.nameTooLong"),
  key: z
    .string()
    .trim()
    .min(1, "releaseDecision.metrics.form.keyRequired")
    .max(128, "releaseDecision.metrics.form.keyTooLong")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
      "releaseDecision.metrics.form.keyInvalid"
    ),
  metricType: z.enum(["binary", "numeric"]),
  metricAgg: z.enum(["once", "count", "sum", "average"]),
  description: z.string(),
})

type FormValues = z.infer<typeof schema>

function usageCounts(metric: Metric) {
  const experiments = metric.experimentUsage?.length ?? 0
  const runs =
    metric.experimentUsage?.reduce(
      (total, usage) => total + (usage.runs?.length ?? 0),
      0
    ) ?? 0
  return { experiments, runs }
}

export function MetricSheet({
  metric,
  saving,
  onOpenChange,
  onSubmit,
}: {
  metric: Metric | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (
    payload: MetricCreatePayload | MetricUpdatePayload
  ) => Promise<void>
}) {
  const { t } = useTranslation()
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(Boolean(metric))
  const [nameInteracted, setNameInteracted] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: metric?.name ?? "",
      key: metric?.key ?? "",
      metricType: metric?.metricType === "numeric" ? "numeric" : "binary",
      metricAgg:
        metric?.metricAgg === "count" ||
        metric?.metricAgg === "sum" ||
        metric?.metricAgg === "average"
          ? metric.metricAgg
          : "once",
      description: metric?.description ?? "",
    },
  })
  const name = useWatch({ control: form.control, name: "name" })
  const metricType = useWatch({ control: form.control, name: "metricType" })
  const metricAgg = useWatch({ control: form.control, name: "metricAgg" })
  const counts = metric ? usageCounts(metric) : null

  useEffect(() => {
    if (!keyManuallyEdited) {
      form.setValue("key", normalizeMetricKey(name), {
        shouldDirty: nameInteracted,
        shouldValidate: nameInteracted,
      })
    }
  }, [form, keyManuallyEdited, name, nameInteracted])

  useEffect(() => {
    if (metricType === "binary" && metricAgg !== "once") {
      form.setValue("metricAgg", "once", {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [form, metricAgg, metricType])

  function requestClose() {
    if (saving) return
    if (form.formState.isDirty) setDiscardOpen(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Sheet
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose()
        }}
      >
        <SheetContent
          className="gap-0 data-[side=right]:w-[min(100vw,460px)] data-[side=right]:sm:max-w-[460px]"
          showCloseButton={!saving}
        >
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <SheetTitle>
              {t(
                metric
                  ? "releaseDecision.metrics.form.editTitle"
                  : "releaseDecision.metrics.form.newTitle"
              )}
            </SheetTitle>
            <SheetDescription className="mt-1.5 max-w-sm leading-5">
              {t(
                metric
                  ? "releaseDecision.metrics.form.editDescription"
                  : "releaseDecision.metrics.form.newDescription"
              )}
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(async (values) => {
              const metricTypeValue = values.metricType as MetricType
              const metricAggValue = (
                metricTypeValue === "binary" ? "once" : values.metricAgg
              ) as MetricAggregation
              const definition = {
                name: values.name.trim(),
                description: values.description.trim() || null,
                metricType: metricTypeValue,
                metricAgg: metricAggValue,
              }
              await onSubmit(
                metric
                  ? definition
                  : {
                      ...definition,
                      key: values.key.trim(),
                    }
              )
            })}
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="metric-name">
                  {t("releaseDecision.metrics.form.name")}
                </Label>
                <Input
                  id="metric-name"
                  maxLength={256}
                  aria-invalid={Boolean(form.formState.errors.name)}
                  {...form.register("name", {
                    onChange: () => setNameInteracted(true),
                  })}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.name.message!)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="metric-key">
                  {t(
                    metric
                      ? "releaseDecision.metrics.form.keyReadOnly"
                      : "releaseDecision.metrics.form.key"
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="metric-key"
                    className={`font-mono ${metric ? "bg-muted/60 pr-10 text-muted-foreground" : ""}`}
                    maxLength={128}
                    readOnly={Boolean(metric)}
                    aria-invalid={Boolean(form.formState.errors.key)}
                    {...form.register("key", {
                      onChange: () => setKeyManuallyEdited(true),
                    })}
                  />
                  {metric ? (
                    <Lock className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t(
                    metric
                      ? "releaseDecision.metrics.form.keyReadOnlyHelper"
                      : "releaseDecision.metrics.form.keyHelper"
                  )}
                </p>
                {form.formState.errors.key ? (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.key.message!)}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="metric-type">
                    {t("releaseDecision.metrics.form.type")}
                  </Label>
                  <Select
                    value={metricType}
                    onValueChange={(value) =>
                      form.setValue("metricType", value as MetricType, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id="metric-type" className="w-full">
                      <SelectValue>
                        {t(`releaseDecision.metrics.types.${metricType}`)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="binary">
                          {t("releaseDecision.metrics.types.binary")}
                        </SelectItem>
                        <SelectItem value="numeric">
                          {t("releaseDecision.metrics.types.numeric")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metric-aggregation">
                    {t("releaseDecision.metrics.form.aggregation")}
                  </Label>
                  <Select
                    value={metricAgg}
                    disabled={metricType === "binary"}
                    onValueChange={(value) =>
                      form.setValue("metricAgg", value as MetricAggregation, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id="metric-aggregation" className="w-full">
                      <SelectValue>
                        {t(`releaseDecision.metrics.aggregations.${metricAgg}`)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(["once", "count", "sum", "average"] as const).map(
                          (aggregation) => (
                            <SelectItem key={aggregation} value={aggregation}>
                              {t(
                                `releaseDecision.metrics.aggregations.${aggregation}`
                              )}
                            </SelectItem>
                          )
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metric-description">
                  {t("releaseDecision.metrics.form.description")}
                </Label>
                <Textarea
                  id="metric-description"
                  className="min-h-24 resize-none"
                  maxLength={1000}
                  {...form.register("description")}
                />
              </div>

              {!metric || (counts && (counts.experiments || counts.runs)) ? (
                <div className="flex gap-3 rounded-lg border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-foreground" />
                  <p>
                    {metric && counts
                      ? t("releaseDecision.metrics.form.usageSummary", counts)
                      : t("releaseDecision.metrics.form.activeNote")}
                  </p>
                </div>
              ) : null}
            </div>

            <SheetFooter className="flex-row justify-end px-6 py-5">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestClose}
              >
                {t("releaseDecision.metrics.form.cancel")}
              </Button>
              <Button
                type="submit"
                className="min-w-32"
                disabled={!form.formState.isValid || saving}
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                {t(
                  saving
                    ? "releaseDecision.metrics.form.saving"
                    : metric
                      ? "releaseDecision.metrics.form.save"
                      : "releaseDecision.metrics.form.create"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("releaseDecision.metrics.form.discardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("releaseDecision.metrics.form.discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t("releaseDecision.metrics.form.keepEditing")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => onOpenChange(false)}
            >
              {t("releaseDecision.metrics.form.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
