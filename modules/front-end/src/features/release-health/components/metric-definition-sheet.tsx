import { zodResolver } from "@hookform/resolvers/zod"
import { Info, WandSparkles } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
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
  calculationsByValueType,
  defaultContractForValueType,
  isMetricValueContractValid,
  metricTemplates,
  metricTemplatesByCategory,
  unitsForMetricContract,
} from "../metrics/metric-contract"
import type {
  MetricTemplateChoice,
  MetricTemplateId,
} from "../metrics/metric-contract"
import type {
  ReleaseMetricCategory,
  ReleaseMetricValueType,
} from "../release-health-types"

const categories = ["impact", "quality", "reliability"] as const
const valueTypes = ["count", "gauge", "rate", "ratio", "distribution"] as const
const calculations = [
  "sum",
  "latest",
  "average",
  "minimum",
  "maximum",
  "per-second",
  "per-minute",
  "per-hour",
  "numerator-over-denominator",
  "one-minus-ratio",
  "p50",
  "p90",
  "p95",
  "p99",
] as const
const units = [
  "count",
  "percent",
  "ratio",
  "milliseconds",
  "seconds",
  "bytes",
  "megabytes",
  "events-per-second",
  "events-per-minute",
  "events-per-hour",
  "requests-per-second",
  "errors-per-minute",
] as const

const schema = z
  .object({
    name: z.string().trim().min(1),
    key: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z][a-z0-9_]*$/),
    description: z.string(),
    category: z.enum(categories),
    template: z.string().min(1),
    valueType: z.enum(valueTypes),
    calculation: z.enum(calculations),
    unit: z.enum(units),
  })
  .superRefine((values, context) => {
    if (!isMetricValueContractValid(values)) {
      context.addIssue({
        code: "custom",
        path: ["valueType"],
        message: "Incompatible metric value contract",
      })
    }

    if (values.template === "custom") return

    const template = metricTemplates[values.template as MetricTemplateId]
    if (
      !template ||
      template.category !== values.category ||
      template.valueType !== values.valueType ||
      template.calculation !== values.calculation ||
      template.unit !== values.unit
    ) {
      context.addIssue({
        code: "custom",
        path: ["template"],
        message: "Template and value contract do not match",
      })
    }
  })

type MetricDefinitionValues = z.infer<typeof schema>

const defaultValues: MetricDefinitionValues = {
  name: "",
  key: "",
  description: "",
  category: "reliability",
  template: "error-rate",
  valueType: "ratio",
  calculation: "numerator-over-denominator",
  unit: "percent",
}

export function MetricDefinitionSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const context = getCurrentProjectEnv()
  const {
    control,
    register,
    reset,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<MetricDefinitionValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const category = useWatch({ control, name: "category" })
  const template = useWatch({ control, name: "template" })
  const valueType = useWatch({ control, name: "valueType" })
  const calculation = useWatch({ control, name: "calculation" })
  const unit = useWatch({ control, name: "unit" })
  const isCustom = template === "custom"
  const templateOptions: MetricTemplateChoice[] = [
    ...metricTemplatesByCategory[category],
    "custom",
  ]

  function setOpen(next: boolean) {
    onOpenChange(next)
    if (!next) reset(defaultValues)
  }

  function applyTemplate(templateId: MetricTemplateId) {
    const definition = metricTemplates[templateId]
    setValue("template", templateId, { shouldValidate: false })
    setValue("valueType", definition.valueType, { shouldValidate: false })
    setValue("calculation", definition.calculation, { shouldValidate: false })
    setValue("unit", definition.unit, { shouldValidate: false })
    void trigger(["category", "template", "valueType", "calculation", "unit"])
  }

  function changeCategory(nextCategory: ReleaseMetricCategory) {
    setValue("category", nextCategory, { shouldValidate: false })
    if (template !== "custom") {
      applyTemplate(metricTemplatesByCategory[nextCategory][0])
      return
    }
    void trigger(["category", "template", "valueType", "calculation", "unit"])
  }

  function changeTemplate(nextTemplate: MetricTemplateChoice) {
    if (nextTemplate === "custom") {
      setValue("template", "custom", { shouldValidate: false })
      void trigger(["template", "valueType", "calculation", "unit"])
      return
    }
    applyTemplate(nextTemplate)
  }

  function changeValueType(nextValueType: ReleaseMetricValueType) {
    const nextContract = defaultContractForValueType(nextValueType)
    setValue("valueType", nextContract.valueType, { shouldValidate: false })
    setValue("calculation", nextContract.calculation, {
      shouldValidate: false,
    })
    setValue("unit", nextContract.unit, { shouldValidate: false })
    void trigger(["valueType", "calculation", "unit"])
  }

  function changeCalculation(
    nextCalculation: MetricDefinitionValues["calculation"]
  ) {
    setValue("calculation", nextCalculation, { shouldValidate: false })
    const compatibleUnits = unitsForMetricContract(valueType, nextCalculation)
    if (!compatibleUnits.includes(unit)) {
      setValue("unit", compatibleUnits[0], { shouldValidate: false })
    }
    void trigger(["valueType", "calculation", "unit"])
  }

  function save() {
    toast.success(t("releaseHealth.metrics.create.previewSaved"))
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-[calc(100%-1rem)] data-[side=right]:sm:max-w-2xl">
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
              <div>
                <h3 className="text-sm font-medium">
                  {t("releaseHealth.metrics.create.definition")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.create.definitionHelp")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="release-metric-name">
                    {t("releaseHealth.metrics.name")}
                  </Label>
                  <Input
                    id="release-metric-name"
                    {...register("name")}
                    aria-invalid={Boolean(errors.name)}
                    placeholder={t(
                      "releaseHealth.metrics.create.namePlaceholder"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="release-metric-key">
                    {t("releaseHealth.metrics.key")}
                  </Label>
                  <Input
                    id="release-metric-key"
                    {...register("key")}
                    aria-invalid={Boolean(errors.key)}
                    className="font-mono"
                    placeholder="checkout_error_rate"
                  />
                  {errors.key ? (
                    <p className="text-xs text-destructive">
                      {t("releaseHealth.metrics.create.keyError")}
                    </p>
                  ) : null}
                </div>
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
            </section>

            <section className="space-y-4 border-t pt-5">
              <div>
                <h3 className="text-sm font-medium">
                  {t("releaseHealth.metrics.create.contractTitle")}
                </h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("releaseHealth.metrics.create.contractHelp")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  control={control}
                  name="category"
                  label={t("releaseHealth.metrics.category")}
                  options={[...categories]}
                  optionLabel={(value) => t(`releaseHealth.category.${value}`)}
                  onValueChange={changeCategory}
                />
                <SelectField
                  control={control}
                  name="template"
                  label={t("releaseHealth.metrics.template")}
                  options={templateOptions}
                  optionLabel={(value) =>
                    t(`releaseHealth.metricTemplate.${value}.label`)
                  }
                  onValueChange={(value) =>
                    changeTemplate(value as MetricTemplateChoice)
                  }
                />
              </div>

              <div className="rounded-md border bg-muted/20 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {t("releaseHealth.metrics.create.valueContract")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t(
                        `releaseHealth.metricTemplate.${template}.description`
                      )}
                    </p>
                  </div>
                  <Badge variant={isCustom ? "outline" : "secondary"}>
                    <WandSparkles />
                    {t(
                      isCustom
                        ? "releaseHealth.metrics.create.customContract"
                        : "releaseHealth.metrics.create.templateFilled"
                    )}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <SelectField
                    control={control}
                    name="valueType"
                    label={t("releaseHealth.metrics.valueType")}
                    options={[...valueTypes]}
                    optionLabel={(value) =>
                      t(`releaseHealth.valueType.${value}`)
                    }
                    onValueChange={changeValueType}
                    disabled={!isCustom}
                  />
                  <SelectField
                    control={control}
                    name="calculation"
                    label={t("releaseHealth.metrics.calculation")}
                    options={calculationsByValueType[valueType]}
                    optionLabel={(value) =>
                      t(`releaseHealth.calculation.${value}`)
                    }
                    onValueChange={changeCalculation}
                    disabled={!isCustom}
                  />
                  <SelectField
                    control={control}
                    name="unit"
                    label={t("releaseHealth.metrics.unit")}
                    options={unitsForMetricContract(valueType, calculation)}
                    optionLabel={(value) => t(`releaseHealth.unit.${value}`)}
                    disabled={!isCustom}
                  />
                </div>
                <div className="mt-4 rounded-md border bg-background px-3 py-2 text-xs leading-5">
                  <span className="font-medium">
                    {t("releaseHealth.metrics.create.calculationSummary")}
                  </span>{" "}
                  {t(`releaseHealth.calculation.${calculation}`)} ·{" "}
                  {t(`releaseHealth.unit.${unit}`)}
                </div>
                {errors.valueType || errors.template ? (
                  <p className="mt-2 text-xs text-destructive">
                    {t("releaseHealth.metrics.create.contractError")}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
          <SheetFooter className="flex-row justify-end border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("releaseHealth.common.cancel")}
            </Button>
            <Button type="submit">
              {t("releaseHealth.metrics.create.save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function SelectField<
  TName extends "category" | "template" | "valueType" | "calculation" | "unit",
>({
  control,
  name,
  label,
  options,
  optionLabel,
  disabled = false,
  onValueChange,
}: {
  control: ReturnType<typeof useForm<MetricDefinitionValues>>["control"]
  name: TName
  label: string
  options: MetricDefinitionValues[TName][]
  optionLabel: (value: MetricDefinitionValues[TName]) => string
  disabled?: boolean
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
            value={field.value}
            disabled={disabled}
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
