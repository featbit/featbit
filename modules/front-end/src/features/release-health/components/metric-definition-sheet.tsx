import { zodResolver } from "@hookform/resolvers/zod"
import { Info } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Alert, AlertDescription } from "@/components/ui/alert"
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

const schema = z.object({
  name: z.string().trim().min(1),
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/),
  description: z.string(),
  category: z.enum(["impact", "quality", "reliability"]),
  signalType: z.enum(["counter", "gauge", "rate", "distribution"]),
  observationScope: z.enum(["flag-contextual", "environment"]),
  source: z.enum(["featbit-events", "opentelemetry"]),
  sourceEvent: z.string().trim().min(1),
  unit: z.string().trim().min(1),
})

type MetricDefinitionValues = z.infer<typeof schema>

const defaultValues: MetricDefinitionValues = {
  name: "",
  key: "",
  description: "",
  category: "quality",
  signalType: "rate",
  observationScope: "flag-contextual",
  source: "featbit-events",
  sourceEvent: "",
  unit: "%",
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
    formState: { errors },
  } = useForm<MetricDefinitionValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  function setOpen(next: boolean) {
    onOpenChange(next)
    if (!next) reset(defaultValues)
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
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  control={control}
                  name="category"
                  label={t("releaseHealth.metrics.category")}
                  options={["impact", "quality", "reliability"]}
                  optionLabel={(value) => t(`releaseHealth.category.${value}`)}
                />
                <SelectField
                  control={control}
                  name="signalType"
                  label={t("releaseHealth.metrics.signal")}
                  options={["counter", "gauge", "rate", "distribution"]}
                  optionLabel={(value) => t(`releaseHealth.signal.${value}`)}
                />
                <div className="space-y-2">
                  <Label htmlFor="release-metric-unit">
                    {t("releaseHealth.metrics.unit")}
                  </Label>
                  <Input
                    id="release-metric-unit"
                    {...register("unit")}
                    aria-invalid={Boolean(errors.unit)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t pt-5">
              <div>
                <h3 className="text-sm font-medium">
                  {t("releaseHealth.metrics.create.sourceBinding")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.create.sourceHelp")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  control={control}
                  name="source"
                  label={t("releaseHealth.metrics.source")}
                  options={["featbit-events", "opentelemetry"]}
                  optionLabel={(value) =>
                    t(`releaseHealth.metrics.sources.${value}`)
                  }
                />
                <div className="space-y-2">
                  <Label htmlFor="release-metric-source-event">
                    {t("releaseHealth.metrics.sourceEvent")}
                  </Label>
                  <Input
                    id="release-metric-source-event"
                    {...register("sourceEvent")}
                    aria-invalid={Boolean(errors.sourceEvent)}
                    className="font-mono"
                    placeholder="checkout_completed"
                  />
                </div>
              </div>
              <SelectField
                control={control}
                name="observationScope"
                label={t("releaseHealth.metrics.observationScope")}
                options={["flag-contextual", "environment"]}
                optionLabel={(value) => t(`releaseHealth.scope.${value}`)}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {t("releaseHealth.metrics.create.scopeHelp")}
              </p>
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
  TName extends "category" | "signalType" | "observationScope" | "source",
>({
  control,
  name,
  label,
  options,
  optionLabel,
}: {
  control: ReturnType<typeof useForm<MetricDefinitionValues>>["control"]
  name: TName
  label: string
  options: MetricDefinitionValues[TName][]
  optionLabel: (value: MetricDefinitionValues[TName]) => string
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
