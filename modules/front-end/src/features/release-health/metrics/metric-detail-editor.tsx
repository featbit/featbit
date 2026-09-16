import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { releaseHealthApi, type LiveMetric } from "../release-health-api"
import { resultContractRange } from "./metric-contract"
import { metricListKey } from "./live-metric-data"

const optionalNumber = (value: string) => (value.trim() ? Number(value) : null)
const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
  category: z.enum(["", "impact", "quality", "reliability"]),
  resultSemantics: z.string().trim().min(12).max(2000),
  minimum: z.string(),
  maximum: z.string(),
  fractionDigits: z.coerce.number<number>().int().min(0).max(4),
})
type Values = z.infer<typeof schema>

export function MetricDetailEditor({
  metric,
  mode,
  onClose,
}: {
  metric: LiveMetric
  mode: "basic" | "contract"
  onClose: () => void
}) {
  const { t } = useTranslation()
  const d = (key: string) => t(`releaseHealth.live.detail.${key}`)
  const client = useQueryClient()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: metric.name,
      description: metric.description ?? "",
      category: metric.category ?? "",
      resultSemantics: metric.resultSemantics,
      minimum: metric.resultContract.constraints.minimum?.toString() ?? "",
      maximum: metric.resultContract.constraints.maximum?.toString() ?? "",
      fractionDigits: metric.fractionDigits ?? 2,
    },
  })
  const [semantics, min, max] = useWatch({
    control,
    name: ["resultSemantics", "minimum", "maximum"],
  })
  const versionChanged =
    semantics.trim() !== metric.resultSemantics ||
    optionalNumber(min) !==
      (metric.resultContract.constraints.minimum ?? null) ||
    optionalNumber(max) !== (metric.resultContract.constraints.maximum ?? null)
  const range = resultContractRange(metric.resultContract.unit)
  async function save(values: Values) {
    const minimum = optionalNumber(values.minimum)
    const maximum = optionalNumber(values.maximum)
    if (
      (minimum !== null &&
        (!Number.isFinite(minimum) ||
          minimum < range.minimum ||
          (range.maximum !== undefined && minimum > range.maximum))) ||
      (maximum !== null &&
        (!Number.isFinite(maximum) ||
          maximum < range.minimum ||
          (range.maximum !== undefined && maximum > range.maximum))) ||
      (minimum !== null && maximum !== null && minimum > maximum)
    ) {
      setError("root", { message: d("invalidRange") })
      return
    }
    if (values.name.toLowerCase() === values.resultSemantics.toLowerCase()) {
      setError("resultSemantics", {
        message: t("releaseHealth.live.semanticsError"),
      })
      return
    }
    try {
      const updated = await releaseHealthApi.updateMetric(
        metric.projectId,
        metric.id,
        {
          ...values,
          description: values.description || null,
          category: values.category || null,
          minimum,
          maximum,
          expectedRevision: metric.revision ?? 1,
        }
      )
      onClose()
      client.setQueryData<LiveMetric[]>(
        metricListKey(metric.projectId),
        (current) =>
          current?.map((item) => (item.id === updated.id ? updated : item))
      )
      toast.success(d("saved"))
      void client.invalidateQueries({ queryKey: ["release-health"] })
    } catch {
      setError("root", { message: d("saveFailed") })
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose()
      }}
    >
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {d(mode === "basic" ? "editBasic" : "editContract")}
          </SheetTitle>
          <SheetDescription>
            {metric.name} · {d("shared")}
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit(save)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="space-y-5 overflow-y-auto px-6 py-4">
            {mode === "basic" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="metric-edit-name">{d("name")}</Label>
                  <Input id="metric-edit-name" {...register("name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric-edit-key">{d("key")}</Label>
                  <Input
                    id="metric-edit-key"
                    value={metric.key}
                    readOnly
                    className="bg-muted font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric-edit-description">
                    {d("description")}
                  </Label>
                  <Textarea
                    id="metric-edit-description"
                    rows={3}
                    {...register("description")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric-edit-category">{d("category")}</Label>
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || "none"}
                        onValueChange={(value) =>
                          field.onChange(value === "none" ? "" : value)
                        }
                      >
                        <SelectTrigger
                          id="metric-edit-category"
                          className="w-full"
                        >
                          <SelectValue>
                            {field.value
                              ? t(`releaseHealth.category.${field.value}`)
                              : "—"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="none">—</SelectItem>
                            {["impact", "quality", "reliability"].map((x) => (
                              <SelectItem key={x} value={x}>
                                {t(`releaseHealth.category.${x}`)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="metric-edit-semantics">
                    {d("semantics")}
                  </Label>
                  <Textarea
                    id="metric-edit-semantics"
                    rows={4}
                    {...register("resultSemantics")}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {d("constraintsHelp")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="metric-edit-min">{d("minimum")}</Label>
                    <Input
                      id="metric-edit-min"
                      type="number"
                      step="any"
                      placeholder={String(range.minimum)}
                      {...register("minimum")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metric-edit-max">{d("maximum")}</Label>
                    <Input
                      id="metric-edit-max"
                      type="number"
                      step="any"
                      placeholder={range.maximum?.toString() ?? "—"}
                      {...register("maximum")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric-edit-digits">{d("digits")}</Label>
                  <Input
                    id="metric-edit-digits"
                    type="number"
                    min={0}
                    max={4}
                    step={1}
                    {...register("fractionDigits", { valueAsNumber: true })}
                  />
                </div>
              </>
            )}
            {versionChanged ? (
              <Alert>
                <AlertDescription>{d("rebind")}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                {d("metadataOnly")}
              </p>
            )}
            {Object.entries(errors).map(([key, error]) => (
              <p key={key} role="alert" className="text-sm text-destructive">
                {error?.message}
              </p>
            ))}
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
            >
              {d("cancel")}
            </Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting
                ? d("saving")
                : versionChanged
                  ? d("saveContract")
                  : d("save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
