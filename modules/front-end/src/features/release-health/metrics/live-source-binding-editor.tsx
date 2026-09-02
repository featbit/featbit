import { useQuery, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import {
  releaseHealthApi,
  type LiveBinding,
  type LiveMetric,
  type LiveTrend,
  type PrometheusConnectionView,
  type ReleaseHealthScope,
} from "../release-health-api"
import { LiveTrendChart } from "./live-metric-panel"

const schema = z.object({
  connectionId: z.string().uuid(),
  promql: z.string().min(1).max(4096),
  step: z.enum(["5s", "15s", "1m", "5m"]),
})
type Draft = z.infer<typeof schema>
export function LiveBindingEditor(props: {
  scope: ReleaseHealthScope
  metric: LiveMetric
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const { scope, metric } = props
  const queryClient = useQueryClient()
  const connections = useQuery({
    queryKey: ["release-health", scope.projectId, scope.envId, "connections"],
    queryFn: () => releaseHealthApi.connections(scope),
    retry: false,
  })
  const binding = useQuery({
    queryKey: [
      "release-health",
      scope.projectId,
      scope.envId,
      metric.id,
      "binding",
    ],
    queryFn: () => releaseHealthApi.binding(scope, metric.id),
    retry: false,
    staleTime: 0,
  })
  if (connections.isError || binding.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t("releaseHealth.live.bindingLoadFailed")}
        </AlertDescription>
      </Alert>
    )
  if (!connections.data || binding.isPending)
    return <p>{t("releaseHealth.live.loading")}</p>
  return (
    <BindingForm
      key={`${binding.data?.revision ?? 0}:${connections.data.map((x) => `${x.id}:${x.version}`).join()}`}
      {...props}
      onSaved={() => {
        void queryClient.invalidateQueries({
          queryKey: [
            "release-health",
            scope.projectId,
            scope.envId,
            metric.id,
            "binding",
          ],
        })
        props.onSaved()
      }}
      connections={connections.data}
      binding={binding.data ?? null}
    />
  )
}
function BindingForm({
  scope,
  metric,
  binding,
  connections,
  onSaved,
}: {
  scope: ReleaseHealthScope
  metric: LiveMetric
  binding: LiveBinding | null
  connections: PrometheusConnectionView[]
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const form = useForm<Draft>({
    resolver: zodResolver(schema),
    defaultValues: {
      connectionId: binding?.connectionId ?? connections[0]?.id ?? "",
      promql: binding?.providerConfig.promql ?? "",
      step: (binding?.providerConfig.step as Draft["step"]) ?? "5s",
    },
  })
  const [preview, setPreview] = useState<{
    fingerprint: string
    data: LiveTrend
  }>()
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const values = useWatch({ control: form.control }) as Draft
  const fingerprint = JSON.stringify(values)
  function write(value: Draft) {
    const connection = connections.find(
      (item) => item.id === value.connectionId
    )!
    return {
      connectionId: connection.id,
      connectionRevision: connection.revision,
      providerType: connection.providerType,
      providerSchemaVersion: connection.providerSchemaVersion,
      providerConfig: {
        promql: value.promql,
        queryMode: "range",
        step: value.step,
      },
      expectedVersion: binding?.revision ?? null,
    }
  }
  async function validate(value: Draft) {
    setError(false)
    setPreview(undefined)
    try {
      setPreview({
        fingerprint: JSON.stringify(value),
        data: await releaseHealthApi.previewBinding(
          scope,
          metric.id,
          write(value)
        ),
      })
    } catch {
      setError(true)
    }
  }
  async function save() {
    if (!preview || preview.fingerprint !== fingerprint) return
    setSaving(true)
    setError(false)
    try {
      await releaseHealthApi.saveBinding(scope, metric.id, write(values))
      onSaved()
    } catch {
      setError(true)
      setPreview(undefined)
    } finally {
      setSaving(false)
    }
  }
  return (
    <form
      onSubmit={form.handleSubmit(validate)}
      className="space-y-4 border-t pt-5"
    >
      <h3 className="font-semibold">
        {t("releaseHealth.live.manageBinding")} · Prometheus-compatible
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("releaseHealth.live.bindingHelp")}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="live-binding-connection">
            {t("releaseHealth.connections.connection")}
          </Label>
          <Select
            value={values.connectionId}
            onValueChange={(value) =>
              value && form.setValue("connectionId", value)
            }
          >
            <SelectTrigger id="live-binding-connection" className="w-full">
              <SelectValue>
                {connections.find((x) => x.id === values.connectionId)?.name ??
                  "—"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.name} · r{connection.revision}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="live-binding-step">Step</Label>
          <Select
            value={values.step}
            onValueChange={(value) =>
              value && form.setValue("step", value as Draft["step"])
            }
          >
            <SelectTrigger id="live-binding-step" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {["5s", "15s", "1m", "5m"].map((step) => (
                  <SelectItem key={step} value={step}>
                    {step}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="live-promql">PromQL</Label>
        <Textarea
          id="live-promql"
          className="min-h-32 font-mono text-xs"
          {...form.register("promql")}
        />
      </div>
      {error || Object.keys(form.formState.errors).length ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("releaseHealth.live.queryFailed")}
          </AlertDescription>
        </Alert>
      ) : null}
      {preview?.fingerprint === fingerprint ? (
        <LiveTrendChart trend={preview.data} />
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          variant="outline"
          disabled={
            form.formState.isSubmitting || saving || !connections.length
          }
        >
          {t("releaseHealth.metrics.sourceBinding.validate")}
        </Button>
        <Button
          type="button"
          disabled={
            saving ||
            form.formState.isSubmitting ||
            !preview ||
            preview.fingerprint !== fingerprint
          }
          onClick={save}
        >
          {t("releaseHealth.metrics.sourceBinding.save")}
        </Button>
      </div>
    </form>
  )
}
