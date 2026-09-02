import { useQuery, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import { ReleaseHealthShell } from "../components/release-health-shell"
import {
  releaseHealthApi,
  type ReleaseHealthScope,
} from "../release-health-api"
import { buildMetricUnit, type MetricUnitKind } from "./metric-contract"
import type { MetricMeasurementKind } from "../release-health-types"
import { LiveMetricPanel } from "./live-metric-panel"

const profiles = [
  "ratio.percent",
  "gauge.duration",
  "rate.rate",
  "gauge.count",
  "gauge.percent",
  "gauge.ratio",
  "gauge.data",
  "count.count",
  "ratio.ratio",
] as const
const metricSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/),
  name: z.string().min(1).max(120),
  resultSemantics: z.string().min(1).max(2000),
  profile: z.enum(profiles),
})
type MetricDraft = z.infer<typeof metricSchema>

export function ReleaseMetricsPage() {
  const context = getCurrentProjectEnv()
  return context ? (
    <Metrics key={`${context.projectId}:${context.envId}`} scope={context} />
  ) : null
}
function Metrics({ scope }: { scope: ReleaseHealthScope }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const queryKey = ["release-health", scope.projectId, "metrics"]
  const query = useQuery({
    queryKey,
    queryFn: () => releaseHealthApi.metrics(scope.projectId),
    retry: false,
  })
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [error, setError] = useState(false)
  const form = useForm<MetricDraft>({
    resolver: zodResolver(metricSchema),
    defaultValues: {
      key: "",
      name: "",
      resultSemantics: "",
      profile: "ratio.percent",
    },
  })
  const selected =
    query.data?.find((metric) => metric.id === selectedId) ?? query.data?.[0]
  const profile = useWatch({ control: form.control, name: "profile" })
  async function create(value: MetricDraft) {
    setError(false)
    const [measurementKind, unitKind] = value.profile.split(".") as [
      MetricMeasurementKind,
      MetricUnitKind,
    ]
    try {
      const metric = await releaseHealthApi.createMetric(scope.projectId, {
        key: value.key,
        name: value.name,
        resultSemantics: value.resultSemantics,
        resultContract: {
          schemaVersion: 1,
          resultKind: "numeric_time_series",
          cardinality: "single",
          measurementKind,
          unit: buildMetricUnit({
            unitKind,
            rateNumerator: "requests",
            ratePeriod: "second",
          }),
          constraints: { minimum: 0, allowNaN: false, allowInfinity: false },
        },
      })
      await client.invalidateQueries({ queryKey })
      setSelectedId(metric.id)
      setCreating(false)
      form.reset()
    } catch {
      setError(true)
    }
  }
  return (
    <ReleaseHealthShell activeTab="metrics" live>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("releaseHealth.live.metricScope")}
          </p>
          <Button onClick={() => setCreating(!creating)}>
            <Plus />
            {t("releaseHealth.metrics.add")}
          </Button>
        </div>
        {creating ? (
          <form
            onSubmit={form.handleSubmit(create)}
            className="space-y-4 rounded-lg border p-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="live-metric-key">
                  {t("releaseHealth.live.key")}
                </Label>
                <Input
                  id="live-metric-key"
                  {...form.register("key")}
                  placeholder="checkout_error_rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="live-metric-name">
                  {t("releaseHealth.connections.name")}
                </Label>
                <Input id="live-metric-name" {...form.register("name")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="live-metric-profile">
                {t("releaseHealth.metrics.resultProfile")}
              </Label>
              <Select
                value={profile}
                onValueChange={(value) =>
                  value &&
                  form.setValue("profile", value as MetricDraft["profile"])
                }
              >
                <SelectTrigger id="live-metric-profile" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {profiles.map((profile) => (
                      <SelectItem key={profile} value={profile}>
                        {profile === "rate.rate"
                          ? "rate · requests / second"
                          : profile.replace(".", " · ")}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="live-metric-semantics">
                {t("releaseHealth.live.semantics")}
              </Label>
              <Textarea
                id="live-metric-semantics"
                {...form.register("resultSemantics")}
              />
            </div>
            {Object.keys(form.formState.errors).length || error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {t("releaseHealth.live.metricFailed")}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreating(false)}
              >
                {t("releaseHealth.common.cancel")}
              </Button>
              <Button disabled={form.formState.isSubmitting}>
                {t("releaseHealth.live.create")}
              </Button>
            </div>
          </form>
        ) : null}
        {query.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t("releaseHealth.live.loadFailed")}
            </AlertDescription>
          </Alert>
        ) : null}
        {query.isPending ? <p>{t("releaseHealth.live.loading")}</p> : null}
        {query.data?.length === 0 ? (
          <div className="rounded-lg border p-10 text-center text-muted-foreground">
            {t("releaseHealth.live.noMetrics")}
          </div>
        ) : null}
        {query.data?.length ? (
          <div className="flex flex-wrap gap-2">
            {query.data.map((metric) => (
              <Button
                key={metric.id}
                variant={selected?.id === metric.id ? "default" : "outline"}
                onClick={() => setSelectedId(metric.id)}
              >
                {metric.name}
              </Button>
            ))}
          </div>
        ) : null}
        {selected ? (
          <LiveMetricPanel key={selected.id} metric={selected} scope={scope} />
        ) : null}
      </div>
    </ReleaseHealthShell>
  )
}
