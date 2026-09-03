import { zodResolver } from "@hookform/resolvers/zod"
import { Info, LockKeyhole } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import type { MetricDefinitionWrite } from "../release-health-api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import {
  buildMetricUnit,
  isMetricResultProfileValid,
  measurementKinds,
  metricUnitLabel,
  rateNumerators,
  ratePeriods,
  resultContractRange,
  unitKindsByMeasurementKind,
} from "../metrics/metric-contract"
import type { MetricMeasurementKind } from "../release-health-types"

const categories = ["none", "impact", "quality", "reliability"] as const
const unitKinds = [
  "count",
  "percent",
  "ratio",
  "duration",
  "data",
  "rate",
] as const
const fractionDigits = ["0", "1", "2", "3", "4"] as const

const schema = z
  .object({
    name: z.string().trim().min(1).max(120),
    key: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().max(2000),
    category: z.enum(categories),
    resultSemantics: z.string().trim().min(12).max(2000),
    measurementKind: z.enum(measurementKinds),
    unitKind: z.enum([...unitKinds, ""]),
    rateNumerator: z.enum(rateNumerators),
    ratePeriod: z.enum(ratePeriods),
    minimum: z.string(),
    maximum: z.string(),
    fractionDigits: z.enum(fractionDigits),
  })
  .superRefine((values, context) => {
    if (!values.unitKind) {
      context.addIssue({
        code: "custom",
        path: ["unitKind"],
        message: "Choose a compatible unit",
      })
      return
    }
    if (values.resultSemantics.toLowerCase() === values.name.toLowerCase()) {
      context.addIssue({
        code: "custom",
        path: ["resultSemantics"],
        message: "Describe what each value means, not just its name",
      })
    }
    if (!isMetricResultProfileValid({ ...values, unitKind: values.unitKind })) {
      context.addIssue({
        code: "custom",
        path: ["unitKind"],
        message: "Incompatible metric result profile",
      })
    }

    const minimum = parseOptionalNumber(values.minimum)
    const maximum = parseOptionalNumber(values.maximum)
    const range = resultContractRange(
      buildMetricUnit({ ...values, unitKind: values.unitKind })
    )
    if (
      minimum !== undefined &&
      (minimum < range.minimum ||
        (range.maximum !== undefined && minimum > range.maximum))
    ) {
      context.addIssue({
        code: "custom",
        path: ["minimum"],
        message: "Minimum is outside the unit range",
      })
    }
    if (
      maximum !== undefined &&
      (maximum < range.minimum ||
        (range.maximum !== undefined && maximum > range.maximum))
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Maximum is outside the unit range",
      })
    }
    if (values.minimum.trim() && minimum === undefined) {
      context.addIssue({
        code: "custom",
        path: ["minimum"],
        message: "Minimum must be a finite number",
      })
    }
    if (values.maximum.trim() && maximum === undefined) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Maximum must be a finite number",
      })
    }
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Maximum must not be lower than minimum",
      })
    }
  })

type MetricDefinitionValues = z.infer<typeof schema>

const defaultValues: MetricDefinitionValues = {
  name: "",
  key: "",
  description: "",
  category: "none",
  resultSemantics: "",
  measurementKind: "ratio",
  unitKind: "percent",
  rateNumerator: "requests",
  ratePeriod: "second",
  minimum: "",
  maximum: "",
  fractionDigits: "2",
}

export function MetricDefinitionSheet({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (value: MetricDefinitionWrite) => Promise<void>
}) {
  const { t } = useTranslation()
  const context = getCurrentProjectEnv()
  const [discardOpen, setDiscardOpen] = useState(false)
  const {
    control,
    register,
    reset,
    handleSubmit,
    setValue,
    trigger,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<MetricDefinitionValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const measurementKind = useWatch({ control, name: "measurementKind" })
  const unitKind = useWatch({ control, name: "unitKind" })
  const rateNumerator = useWatch({ control, name: "rateNumerator" })
  const ratePeriod = useWatch({ control, name: "ratePeriod" })
  const unit = unitKind
    ? buildMetricUnit({ unitKind, rateNumerator, ratePeriod })
    : undefined
  const intrinsicRange = unit
    ? resultContractRange(unit)
    : { minimum: 0, maximum: undefined }

  function setOpen(next: boolean) {
    if (isSubmitting) return
    if (!next && isDirty) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(next)
    if (!next) reset(defaultValues)
  }

  function changeMeasurementKind(next: MetricMeasurementKind) {
    setValue("measurementKind", next, { shouldValidate: false })
    if (!unitKind || !unitKindsByMeasurementKind[next].includes(unitKind)) {
      setValue("unitKind", "", {
        shouldValidate: false,
        shouldDirty: true,
      })
    }
    void trigger(["measurementKind", "unitKind"])
  }

  async function save(values: MetricDefinitionValues) {
    if (!onCreate || !values.unitKind) return
    clearErrors("root")
    try {
      await onCreate({
        name: values.name,
        key: values.key,
        description: values.description.trim(),
        category: values.category === "none" ? null : values.category,
        fractionDigits: Number(values.fractionDigits),
        resultSemantics: values.resultSemantics,
        resultContract: {
          schemaVersion: 1,
          resultKind: "numeric_time_series",
          cardinality: "single",
          measurementKind: values.measurementKind,
          unit: buildMetricUnit({ ...values, unitKind: values.unitKind }),
          constraints: {
            minimum: parseOptionalNumber(values.minimum),
            maximum: parseOptionalNumber(values.maximum),
            allowNaN: false,
            allowInfinity: false,
          },
        },
      })
      toast.success(t("releaseHealth.live.metricSaved"))
      reset(defaultValues)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof Error && error.message === "metric_key_exists") {
        setError(
          "key",
          { message: t("releaseHealth.live.keyExists") },
          { shouldFocus: true }
        )
      } else {
        setError("root", { message: t("releaseHealth.live.metricFailed") })
      }
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-[calc(100%-1rem)] data-[side=right]:sm:max-w-3xl">
          <SheetHeader className="border-b px-4 py-5 sm:px-6">
            <SheetTitle>{t("releaseHealth.metrics.create.title")}</SheetTitle>
            <SheetDescription>
              {t("releaseHealth.metrics.create.description")}
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => void handleSubmit(save)(event)}
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
              <Alert>
                <Info />
                <AlertDescription>
                  {t("releaseHealth.metrics.create.scopeNotice", {
                    project: context?.projectName ?? "Project",
                    environment: context?.envName ?? "Environment",
                  })}
                </AlertDescription>
              </Alert>

              <section className="space-y-4">
                <SectionHeading
                  title={t("releaseHealth.metrics.create.definition")}
                  description={t("releaseHealth.metrics.create.definitionHelp")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="release-metric-name"
                    label={t("releaseHealth.metrics.name")}
                    error={Boolean(errors.name)}
                  >
                    <Input
                      id="release-metric-name"
                      {...register("name")}
                      aria-invalid={Boolean(errors.name)}
                      placeholder={t(
                        "releaseHealth.metrics.create.namePlaceholder"
                      )}
                    />
                  </TextField>
                  <TextField
                    id="release-metric-key"
                    label={t("releaseHealth.metrics.key")}
                    error={Boolean(errors.key)}
                    errorText={
                      errors.key?.message === t("releaseHealth.live.keyExists")
                        ? errors.key.message
                        : t("releaseHealth.metrics.create.keyError")
                    }
                  >
                    <Input
                      id="release-metric-key"
                      {...register("key")}
                      aria-invalid={Boolean(errors.key)}
                      className="font-mono"
                      placeholder="checkout_error_rate"
                    />
                  </TextField>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="release-metric-description">
                    {t("releaseHealth.metrics.descriptionLabel")}
                  </Label>
                  <Textarea
                    id="release-metric-description"
                    {...register("description")}
                    rows={3}
                  />
                </div>
                <SelectField
                  control={control}
                  name="category"
                  label={t("releaseHealth.metrics.category")}
                  options={[...categories]}
                  optionLabel={(value) =>
                    value === "none"
                      ? t("releaseHealth.metrics.uncategorized")
                      : t(`releaseHealth.category.${value}`)
                  }
                />
              </section>

              <section className="space-y-4 border-t pt-5">
                <SectionHeading
                  title={t("releaseHealth.metrics.create.contractTitle")}
                  description={t("releaseHealth.metrics.create.contractHelp")}
                />
                <div className="space-y-2">
                  <Label htmlFor="release-metric-semantics">
                    {t("releaseHealth.metrics.resultSemantics")}
                  </Label>
                  <Textarea
                    id="release-metric-semantics"
                    {...register("resultSemantics")}
                    aria-invalid={Boolean(errors.resultSemantics)}
                    rows={3}
                    placeholder={t(
                      "releaseHealth.metrics.create.resultSemanticsPlaceholder"
                    )}
                  />
                  {errors.resultSemantics ? (
                    <p className="text-xs text-destructive">
                      {t("releaseHealth.live.semanticsError")}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {t("releaseHealth.metrics.create.resultSemanticsHelp")}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    control={control}
                    name="measurementKind"
                    label={t("releaseHealth.metrics.measurementKind")}
                    options={[...measurementKinds]}
                    optionLabel={(value) =>
                      t(`releaseHealth.resultContract.measurementKind.${value}`)
                    }
                    onValueChange={(value) =>
                      changeMeasurementKind(value as MetricMeasurementKind)
                    }
                  />
                  <SelectField
                    control={control}
                    name="unitKind"
                    label={t("releaseHealth.metrics.unit")}
                    options={[...unitKindsByMeasurementKind[measurementKind]]}
                    optionLabel={(value) =>
                      value
                        ? t(`releaseHealth.resultContract.unit.${value}`)
                        : t("releaseHealth.live.selectUnit")
                    }
                    onValueChange={() => {
                      // Kind changes validate before submit; unit selection must
                      // also revalidate so that manually triggered errors clear.
                      void trigger("unitKind")
                    }}
                  />
                </div>

                {unitKind === "rate" ? (
                  <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
                    <SelectField
                      control={control}
                      name="rateNumerator"
                      label={t("releaseHealth.metrics.create.rateNumerator")}
                      options={[...rateNumerators]}
                      optionLabel={(value) =>
                        t(`releaseHealth.resultContract.rateNumerator.${value}`)
                      }
                    />
                    <SelectField
                      control={control}
                      name="ratePeriod"
                      label={t("releaseHealth.metrics.create.ratePeriod")}
                      options={[...ratePeriods]}
                      optionLabel={(value) =>
                        t(`releaseHealth.resultContract.ratePeriod.${value}`)
                      }
                    />
                  </div>
                ) : null}

                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      {t("releaseHealth.metrics.create.resultShape")}
                    </p>
                    <Badge variant="outline">
                      <LockKeyhole />
                      {t("releaseHealth.metrics.create.mixedLocked")}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div
                      aria-label={t("releaseHealth.metrics.create.resultKind")}
                      className="rounded-md border bg-background px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        {t("releaseHealth.metrics.create.resultKind")}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {t("releaseHealth.metrics.create.resultKindValue")}
                      </p>
                      <code className="text-xs text-muted-foreground">
                        numeric_time_series
                      </code>
                    </div>
                    <div
                      aria-label={t("releaseHealth.metrics.create.cardinality")}
                      className="rounded-md border bg-background px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        {t("releaseHealth.metrics.create.cardinality")}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {t("releaseHealth.metrics.create.cardinalityValue")}
                      </p>
                      <code className="text-xs text-muted-foreground">
                        single
                      </code>
                    </div>
                  </div>
                  <div className="mt-3 rounded-md border bg-background px-3 py-2 text-xs leading-5">
                    <span className="font-medium">
                      {t("releaseHealth.metrics.create.profileSummary")}
                    </span>{" "}
                    {t(
                      `releaseHealth.resultContract.measurementKind.${measurementKind}`
                    )}{" "}
                    ·{" "}
                    {unit
                      ? metricUnitLabel(t, unit)
                      : t("releaseHealth.live.selectUnit")}
                  </div>
                  {errors.unitKind ? (
                    <p className="mt-2 text-xs text-destructive">
                      {t("releaseHealth.metrics.create.contractError")}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="space-y-4 border-t pt-5">
                <SectionHeading
                  title={t(
                    "releaseHealth.metrics.create.displayAndConstraints"
                  )}
                  description={t(
                    "releaseHealth.metrics.create.displayAndConstraintsHelp"
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField
                    id="release-metric-minimum"
                    label={t("releaseHealth.metrics.create.minimum")}
                    error={Boolean(errors.minimum)}
                    errorText={t("releaseHealth.metrics.create.contractError")}
                  >
                    <Input
                      id="release-metric-minimum"
                      type="number"
                      step="any"
                      {...register("minimum")}
                      aria-invalid={Boolean(errors.minimum)}
                      placeholder={String(intrinsicRange.minimum)}
                    />
                  </TextField>
                  <TextField
                    id="release-metric-maximum"
                    label={t("releaseHealth.metrics.create.maximum")}
                    error={Boolean(errors.maximum)}
                    errorText={t("releaseHealth.metrics.create.contractError")}
                  >
                    <Input
                      id="release-metric-maximum"
                      type="number"
                      step="any"
                      {...register("maximum")}
                      aria-invalid={Boolean(errors.maximum)}
                      placeholder={
                        intrinsicRange.maximum === undefined
                          ? t("releaseHealth.metrics.create.noMaximum")
                          : String(intrinsicRange.maximum)
                      }
                    />
                  </TextField>
                  <SelectField
                    control={control}
                    name="fractionDigits"
                    label={t("releaseHealth.metrics.create.fractionDigits")}
                    options={[...fractionDigits]}
                    optionLabel={(value) => value}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.create.canonicalRange", {
                    range:
                      intrinsicRange.maximum === undefined
                        ? `${intrinsicRange.minimum}+`
                        : `${intrinsicRange.minimum}–${intrinsicRange.maximum}`,
                    unit: unit
                      ? metricUnitLabel(t, unit)
                      : t("releaseHealth.live.selectUnit"),
                  })}
                </p>
              </section>
            </div>
            {errors.root ? (
              <Alert variant="destructive" className="mx-6 mb-3 w-auto">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            ) : null}
            <SheetFooter className="flex-row justify-end border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setOpen(false)}
              >
                {t("releaseHealth.common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting || !onCreate}>
                {t("releaseHealth.metrics.create.save")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent role="alertdialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("releaseHealth.live.discardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("releaseHealth.live.discardHelp")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>
              {t("releaseHealth.live.keepEditing")}
            </AlertDialogCancel>
            <AlertDialogAction
              render={<Button />}
              onClick={() => {
                reset(defaultValues)
                setDiscardOpen(false)
                onOpenChange(false)
              }}
            >
              {t("releaseHealth.live.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function TextField({
  id,
  label,
  error,
  errorText,
  children,
}: {
  id: string
  label: string
  error: boolean
  errorText?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && errorText ? (
        <p className="text-xs text-destructive">{errorText}</p>
      ) : null}
    </div>
  )
}

function SelectField<
  TName extends
    | "category"
    | "measurementKind"
    | "unitKind"
    | "rateNumerator"
    | "ratePeriod"
    | "fractionDigits",
>({
  control,
  name,
  label,
  options,
  optionLabel,
  onValueChange,
}: {
  control: ReturnType<typeof useForm<MetricDefinitionValues>>["control"]
  name: TName
  label: string
  options: MetricDefinitionValues[TName][]
  optionLabel: (value: MetricDefinitionValues[TName]) => string
  onValueChange?: (value: MetricDefinitionValues[TName]) => void
}) {
  const id = `release-metric-${name}`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            // Base UI uses null for no selection. An empty string can restore
            // the initial option when the compatible options change.
            value={field.value || null}
            onValueChange={(value) => {
              if (!value) return
              const typedValue = value as MetricDefinitionValues[TName]
              field.onChange(typedValue)
              onValueChange?.(typedValue)
            }}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue>{optionLabel(field.value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {optionLabel(option)}
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

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
