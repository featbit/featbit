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
import { SourceConnectionSelect } from "./source-connection-select"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
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
  environmentName,
}: {
  scope: ReleaseHealthScope
  metric: LiveMetric
  binding: LiveBinding | null
  connections: PrometheusConnectionView[]
  onSaved: () => void
  onCancel?: () => void
  environmentName?: string
}) {
  const { t } = useTranslation()
  const [binding] = useState(latestBinding)
  const bindingChanged = binding?.revision !== latestBinding?.revision
  const [discardOpen, setDiscardOpen] = useState(false)
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
        <SourceConnectionSelect
          scope={scope}
          connections={connections}
          value={values.connectionId}
          onValueChange={(value) =>
            form.setValue("connectionId", value, { shouldDirty: true })
          }
          disabled={saving || form.formState.isSubmitting}
        />
        <Card role="region" aria-labelledby="binding-query-heading">
          <CardHeader>
            <CardTitle>
              <h2 id="binding-query-heading">
                {t("releaseHealth.metrics.sourceBinding.queryStep")}
              </h2>
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
            <div className="flex justify-end">
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
              <div className="border-t pt-4">
                <LiveTrendChart
                  trend={preview.data}
                  fractionDigits={metric.fractionDigits ?? 2}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {t("releaseHealth.metrics.sourceBinding.reviewStep")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {metric.name} · {environmentName} ·{" "}
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
