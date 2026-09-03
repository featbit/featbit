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
import { metricResultProfileLabel } from "./metric-contract"
import { toast } from "sonner"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SourceConnectionSheet } from "../components/source-connection-sheet"
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

const schema = z.object({
  connectionId: z.string().uuid(),
  promql: z.string().min(1).max(4096),
  step: z.enum(["5s", "15s", "1m", "5m", "15m"]),
})
type Draft = z.infer<typeof schema>
export function LiveBindingEditor(props: {
  scope: ReleaseHealthScope
  metric: LiveMetric
  onSaved: () => void
  onCancel?: () => void
  environmentKey?: string
  environmentName?: string
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
      key={scope.envId + metric.id}
      {...props}
      onSaved={() => {
        void queryClient.invalidateQueries({
          queryKey: ["release-health", scope.projectId, scope.envId, metric.id],
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
  binding: latestBinding,
  connections,
  onSaved,
  onCancel,
  environmentKey,
  environmentName,
}: {
  scope: ReleaseHealthScope
  metric: LiveMetric
  binding: LiveBinding | null
  connections: PrometheusConnectionView[]
  onSaved: () => void
  onCancel?: () => void
  environmentKey?: string
  environmentName?: string
}) {
  const { t } = useTranslation()
  const [binding] = useState(latestBinding)
  const bindingChanged = binding?.revision !== latestBinding?.revision
  const queryClient = useQueryClient()
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [testing, setTesting] = useState(false)
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
  const { isDirty } = form.formState
  const fingerprintFor = (value: Draft) =>
    JSON.stringify({
      ...value,
      connectionRevision: connections.find((c) => c.id === value.connectionId)
        ?.revision,
    })
  const fingerprint = fingerprintFor(values)
  const changed =
    !binding ||
    values.connectionId !== binding.connectionId ||
    connections.find((c) => c.id === values.connectionId)?.revision !==
      binding.connectionRevision ||
    values.promql !== binding.providerConfig.promql ||
    values.step !== binding.providerConfig.step
  async function testConnection() {
    if (!values.connectionId) return
    setTesting(true)
    setError(false)
    try {
      await releaseHealthApi.testSaved(scope, values.connectionId)
      toast.success(t("releaseHealth.live.testPassed"))
    } catch {
      toast.error(t("releaseHealth.live.connectionFailed"))
    } finally {
      setTesting(false)
    }
  }
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
        fingerprint: fingerprintFor(value),
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
    if (
      bindingChanged ||
      !changed ||
      !preview ||
      preview.fingerprint !== fingerprint
    )
      return
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
    <>
      <form onSubmit={form.handleSubmit(validate)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              1. {t("releaseHealth.metrics.sourceBinding.providerStep")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.metrics.sourceBinding.providerStepHelp")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Badge variant="outline">Prometheus-compatible · v1</Badge>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConnectionOpen(true)}
              >
                {t("releaseHealth.connections.add")}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="live-binding-connection">
                  {t("releaseHealth.connections.connection")}
                </Label>
                <Select
                  value={values.connectionId}
                  onValueChange={(value) =>
                    value &&
                    form.setValue("connectionId", value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger
                    id="live-binding-connection"
                    className="w-full"
                  >
                    <SelectValue>
                      {connections.find((x) => x.id === values.connectionId)
                        ?.name ?? "—"}
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
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !values.connectionId ||
                    testing ||
                    saving ||
                    form.formState.isSubmitting
                  }
                  onClick={testConnection}
                >
                  {t("releaseHealth.connections.test")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              2. {t("releaseHealth.metrics.sourceBinding.queryStep")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.live.syncUnavailable")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="live-binding-step">Step</Label>
                <Select
                  value={values.step}
                  onValueChange={(value) =>
                    value &&
                    form.setValue("step", value as Draft["step"], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="live-binding-step" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {["5s", "15s", "1m", "5m", "15m"].map((step) => (
                        <SelectItem key={step} value={step}>
                          {step}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              query_range · range · {t("releaseHealth.live.onDemand")}
            </p>
            <div className="space-y-2">
              <Label htmlFor="live-promql">PromQL</Label>
              <Textarea
                id="live-promql"
                className="min-h-32 font-mono text-xs"
                {...form.register("promql")}
              />
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-sm font-medium">
                {t("releaseHealth.metrics.resultSemantics")}
              </p>
              <p className="mt-2 text-sm">{metric.resultSemantics}</p>
              <p className="mt-2 font-mono text-xs">
                {metricResultProfileLabel(t, metric)} · numeric_time_series ·
                single
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("releaseHealth.metrics.detail.constraints")}:{" "}
                {metric.resultContract.constraints.minimum ?? 0} –{" "}
                {metric.resultContract.constraints.maximum ??
                  (metric.resultContract.unit.kind === "percent"
                    ? 100
                    : metric.resultContract.unit.kind === "ratio"
                      ? 1
                      : "∞")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              3. {t("releaseHealth.metrics.sourceBinding.validate")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.live.bindingHelp")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ||
            bindingChanged ||
            Object.keys(form.formState.errors).length ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {t("releaseHealth.live.queryFailed")}
                </AlertDescription>
              </Alert>
            ) : null}
            {preview?.fingerprint === fingerprint ? (
              <LiveTrendChart
                trend={preview.data}
                fractionDigits={metric.fractionDigits ?? 2}
              />
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                variant="outline"
                disabled={
                  bindingChanged ||
                  form.formState.isSubmitting ||
                  saving ||
                  !connections.length
                }
              >
                {t("releaseHealth.metrics.sourceBinding.validate")}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              4. {t("releaseHealth.metrics.sourceBinding.reviewStep")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {metric.name} · v{metric.version} · {environmentName} ·{" "}
              {connections.find((c) => c.id === values.connectionId)?.name ??
                "—"}{" "}
              · Step {values.step}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("releaseHealth.live.syncUnavailable")}
            </p>
            <div className="flex justify-end gap-2">
              {onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || form.formState.isSubmitting}
                  onClick={() => (isDirty ? setDiscardOpen(true) : onCancel())}
                >
                  {t("releaseHealth.common.cancel")}
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={
                  saving ||
                  form.formState.isSubmitting ||
                  !changed ||
                  bindingChanged ||
                  !preview ||
                  preview.fingerprint !== fingerprint
                }
                onClick={save}
              >
                {t("releaseHealth.metrics.sourceBinding.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
      <SourceConnectionSheet
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
        environmentKey={environmentKey ?? ""}
        environmentName={environmentName ?? ""}
        liveScope={scope}
        onSaved={(connection) => {
          form.setValue("connectionId", connection.id, { shouldDirty: true })
          setPreview(undefined)
          void queryClient.invalidateQueries({
            queryKey: [
              "release-health",
              scope.projectId,
              scope.envId,
              "connections",
            ],
          })
        }}
      />
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
            <AlertDialogAction render={<Button />} onClick={onCancel}>
              {t("releaseHealth.live.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
