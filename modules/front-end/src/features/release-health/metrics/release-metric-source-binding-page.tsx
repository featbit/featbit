import { Check, CircleMinus, Info, Play, Save } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DetailBackLink } from "@/components/detail-back-link"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { metricSampleText } from "../release-health-display"
import { metricByKey } from "../release-health-mock-data"
import type {
  MetricSourceType,
  ReleaseMetricValueType,
} from "../release-health-types"

type ValidationState = "idle" | "valid"

const featBitSelectorsByValueType: Record<
  ReleaseMetricValueType,
  readonly string[]
> = {
  count: ["checkout_completed", "order_completed", "signup_completed"],
  gauge: ["memory_utilization", "cpu_utilization", "queue_depth"],
  rate: ["request_error", "request_completed", "job_failed"],
  ratio: [
    "request_error / checkout_request",
    "checkout_completed / exposed_users",
    "1 - app_crash / app_session",
  ],
  distribution: ["page_load_duration", "request_duration", "job_duration"],
}

const prometheusDefaults: Record<ReleaseMetricValueType, string> = {
  count: "sum(increase(checkout_completed_total[5m]))",
  gauge: "avg(process_memory_utilization_ratio)",
  rate: "sum(rate(http_requests_total[5m]))",
  ratio:
    "sum(rate(request_error_total[5m])) / sum(rate(checkout_request_total[5m]))",
  distribution:
    "histogram_quantile(0.95, sum(rate(http_server_duration_bucket[5m])) by (le))",
}

export function ReleaseMetricSourceBindingPage() {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const lang = resolveLang(params.lang)
  const context = getCurrentProjectEnv()
  const metricKey = decodeURIComponent(params.metricKey ?? "")
  const environmentKey = decodeURIComponent(params.environmentKey ?? "")
  const metric = metricByKey(metricKey)
  const currentEnvironment = environmentKey === context?.envKey
  const environmentName = currentEnvironment
    ? (context?.envName ?? environmentKey)
    : environmentKey.charAt(0).toUpperCase() + environmentKey.slice(1)
  const existingBinding = currentEnvironment
    ? metric?.environment.sourceBinding
    : undefined
  const existingSource = existingBinding?.sourceType
  const metricValueType = metric?.valueType ?? "ratio"
  const initialConnection =
    existingBinding?.connectionName === "Shared metrics gateway"
      ? "shared-gateway"
      : "production-metrics"
  const initialSelector =
    existingBinding?.selector ?? featBitSelectorsByValueType[metricValueType][0]
  const [sourceType, setSourceType] = useState<MetricSourceType>(
    existingSource ?? "featbit-events"
  )
  const [connection, setConnection] = useState(initialConnection)
  const [selector, setSelector] = useState(initialSelector)
  const [validation, setValidation] = useState<ValidationState>("idle")

  if (!metric) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("releaseHealth.metrics.detail.notFound")}
          </p>
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <Link to={localizedPath(lang, "/release-health/metrics")} />
            }
          >
            {t("releaseHealth.metrics.detail.back")}
          </Button>
        </div>
      </div>
    )
  }

  const detailPath = localizedPath(
    lang,
    `/release-health/metrics/${encodeURIComponent(metric.key)}`
  )
  const isManage = Boolean(existingBinding)
  const isDirty =
    !existingBinding ||
    sourceType !== existingBinding.sourceType ||
    selector !== existingBinding.selector ||
    (sourceType === "prometheus" && connection !== initialConnection)
  const featBitSelectors = Array.from(
    new Set([
      ...(sourceType === "featbit-events" && existingBinding?.selector
        ? [existingBinding.selector]
        : []),
      ...featBitSelectorsByValueType[metric.valueType],
    ])
  )
  const supportsFlagContext = sourceType === "featbit-events"
  const capabilities = [
    {
      key: "environment",
      available: true,
    },
    {
      key: "flagKey",
      available: supportsFlagContext,
    },
    {
      key: "revision",
      available: false,
    },
    {
      key: "variation",
      available: supportsFlagContext,
    },
    {
      key: "exposure",
      available: supportsFlagContext,
    },
  ] as const

  function changeSource(nextSource: MetricSourceType) {
    setSourceType(nextSource)
    setValidation("idle")
    setSelector(
      nextSource === "featbit-events"
        ? featBitSelectorsByValueType[metricValueType][0]
        : prometheusDefaults[metricValueType]
    )
  }

  function validate() {
    if (!selector.trim()) return
    setValidation("valid")
    toast.success(t("releaseHealth.metrics.sourceBinding.validationPassed"))
  }

  function save() {
    if (validation !== "valid" || !isDirty) return
    toast.success(t("releaseHealth.metrics.sourceBinding.savedPreview"))
    navigate(detailPath)
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <DetailBackLink to={detailPath}>
        {metricSampleText(t, metric, "name")}
      </DetailBackLink>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t(
            isManage
              ? "releaseHealth.metrics.sourceBinding.manageTitle"
              : "releaseHealth.metrics.sourceBinding.title"
          )}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t("releaseHealth.metrics.sourceBinding.description", {
            metric: metricSampleText(t, metric, "name"),
            environment: environmentName,
          })}
        </p>
      </header>

      <Alert className="mb-5">
        <Info />
        <AlertDescription>
          {t("releaseHealth.metrics.sourceBinding.boundaryNotice")}
        </AlertDescription>
      </Alert>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.sourceBinding.metric")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{metricSampleText(t, metric, "name")}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {metric.key} · v{metric.version}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(`releaseHealth.valueType.${metric.valueType}`)} ·{" "}
              {t(`releaseHealth.calculation.${metric.calculation}`)} ·{" "}
              {t(`releaseHealth.unit.${metric.unit}`)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.sourceBinding.environment")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{environmentName}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {environmentKey}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("releaseHealth.metrics.sourceBinding.environmentIsolation")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("releaseHealth.metrics.sourceBinding.sourceAndMapping")}
              </CardTitle>
              <CardDescription>
                {t("releaseHealth.metrics.sourceBinding.sourceAndMappingHelp")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="metric-source-type">
                  {t("releaseHealth.metrics.source")}
                </Label>
                <Select
                  value={sourceType}
                  onValueChange={(value) =>
                    value && changeSource(value as MetricSourceType)
                  }
                >
                  <SelectTrigger id="metric-source-type" className="w-full">
                    <SelectValue>
                      {t(`releaseHealth.metrics.sources.${sourceType}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="featbit-events">
                        {t("releaseHealth.metrics.sources.featbit-events")}
                      </SelectItem>
                      <SelectItem value="prometheus">
                        {t("releaseHealth.metrics.sources.prometheus")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {sourceType === "prometheus" ? (
                <div className="space-y-2">
                  <Label htmlFor="metric-source-connection">
                    {t("releaseHealth.metrics.sourceBinding.connection")}
                  </Label>
                  <Select
                    value={connection}
                    onValueChange={(value) => {
                      if (!value) return
                      setConnection(value)
                      setValidation("idle")
                    }}
                  >
                    <SelectTrigger
                      id="metric-source-connection"
                      className="w-full"
                    >
                      <SelectValue>
                        {connection === "production-metrics"
                          ? "Production metrics"
                          : "Shared metrics gateway"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="production-metrics">
                          Production metrics
                        </SelectItem>
                        <SelectItem value="shared-gateway">
                          Shared metrics gateway
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {sourceType === "featbit-events" ? (
                <div className="space-y-2">
                  <Label htmlFor="metric-source-selector">
                    {t("releaseHealth.metrics.sourceBinding.eventSelector")}
                  </Label>
                  <Select
                    value={selector}
                    onValueChange={(value) => {
                      if (!value) return
                      setSelector(value)
                      setValidation("idle")
                    }}
                  >
                    <SelectTrigger
                      id="metric-source-selector"
                      className="w-full font-mono"
                    >
                      <SelectValue>{selector}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {featBitSelectors.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="metric-promql">PromQL</Label>
                  <Textarea
                    id="metric-promql"
                    value={selector}
                    rows={6}
                    className="font-mono text-xs"
                    onChange={(event) => {
                      setSelector(event.target.value)
                      setValidation("idle")
                    }}
                  />
                </div>
              )}

              <div className="rounded-md border bg-muted/20 p-3 text-xs leading-5">
                <span className="font-medium">
                  {t("releaseHealth.metrics.sourceBinding.expectedResult")}
                </span>{" "}
                {t(`releaseHealth.valueType.${metric.valueType}`)} ·{" "}
                {t(`releaseHealth.calculation.${metric.calculation}`)} ·{" "}
                {t(`releaseHealth.unit.${metric.unit}`)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("releaseHealth.metrics.sourceBinding.testAndPreview")}
              </CardTitle>
              <CardDescription>
                {t("releaseHealth.metrics.sourceBinding.testAndPreviewHelp")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
                <div>
                  <p className="text-sm font-medium">
                    {validation === "valid"
                      ? t("releaseHealth.metrics.sourceBinding.previewReady")
                      : t("releaseHealth.metrics.sourceBinding.previewPending")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {validation === "valid"
                      ? t("releaseHealth.metrics.sourceBinding.previewSample", {
                          value: metric.environment.displayValue,
                        })
                      : t(
                          "releaseHealth.metrics.sourceBinding.previewInstruction"
                        )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selector.trim()}
                  onClick={validate}
                >
                  <Play />
                  {t("releaseHealth.metrics.sourceBinding.validate")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>
              {t("releaseHealth.metrics.sourceBinding.capabilities")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.metrics.sourceBinding.capabilitiesHelp")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {capabilities.map((capability) => (
              <div
                key={capability.key}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
              >
                <span className="text-sm">
                  {t(
                    `releaseHealth.metrics.sourceBinding.capability.${capability.key}`
                  )}
                </span>
                <Badge
                  variant={
                    validation === "valid" && capability.available
                      ? "secondary"
                      : "outline"
                  }
                  className="font-normal"
                >
                  {validation !== "valid" ? (
                    <Info />
                  ) : capability.available ? (
                    <Check />
                  ) : (
                    <CircleMinus />
                  )}
                  {t(
                    validation !== "valid"
                      ? "releaseHealth.metrics.sourceBinding.notChecked"
                      : capability.available
                        ? "releaseHealth.metrics.sourceBinding.available"
                        : "releaseHealth.metrics.sourceBinding.notAvailable"
                  )}
                </Badge>
              </div>
            ))}
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
              {t("releaseHealth.metrics.sourceBinding.capabilityNotice")}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link to={detailPath} />}
        >
          {t("releaseHealth.common.cancel")}
        </Button>
        <Button disabled={validation !== "valid" || !isDirty} onClick={save}>
          <Save />
          {t("releaseHealth.metrics.sourceBinding.save")}
        </Button>
      </div>
    </div>
  )
}
