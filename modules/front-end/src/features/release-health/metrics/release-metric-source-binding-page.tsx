import { CheckCircle2, Clock3, Info, Play, Plus, Save } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { DetailBackLink } from "@/components/detail-back-link"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { SourceConnectionSheet } from "../components/source-connection-sheet"
import { metricSampleText } from "../release-health-display"
import {
  metricByKey,
  metricSourceConnections,
} from "../release-health-mock-data"
import type { MetricSourceConnection } from "../release-health-types"
import {
  formatMetricValue,
  metricResultProfileLabel,
  metricUnitLabel,
} from "./metric-contract"

type ValidationState = "idle" | "valid"
type StepValue = "1m" | "5m" | "15m"
type SyncIntervalValue = "1m" | "5m"

const prometheusDefaults: Record<string, string> = {
  checkout_error_rate:
    '100 * sum(rate(http_requests_total{service="checkout",status=~"5.."}[5m])) / sum(rate(http_requests_total{service="checkout"}[5m]))',
  api_p95_latency:
    "1000 * histogram_quantile(0.95, sum(rate(http_server_duration_bucket[5m])) by (le))",
  checkout_completion_rate:
    "100 * sum(increase(checkout_completed_total[5m])) / sum(increase(checkout_started_total[5m]))",
  service_memory_saturation:
    "100 * max(process_memory_working_set_bytes / container_memory_limit_bytes)",
  crash_free_sessions:
    "100 * (1 - sum(increase(app_crash_total[5m])) / sum(increase(app_session_total[5m])))",
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
  const [connections, setConnections] = useState<MetricSourceConnection[]>(() =>
    metricSourceConnections.map((connection) => ({
      ...connection,
      environmentKey,
    }))
  )
  const initialConnectionId =
    existingBinding?.connectionId ?? connections[0]?.id ?? ""
  const initialQuery =
    existingBinding?.query ?? prometheusDefaults[metricKey] ?? ""
  const initialStep = existingBinding?.step ?? "1m"
  const initialSyncInterval = existingBinding?.syncInterval ?? "1m"
  const [connectionId, setConnectionId] = useState(initialConnectionId)
  const [query, setQuery] = useState(initialQuery)
  const [step, setStep] = useState<StepValue>(initialStep)
  const [syncInterval, setSyncInterval] =
    useState<SyncIntervalValue>(initialSyncInterval)
  const [connectionTested, setConnectionTested] = useState(
    connections.find((connection) => connection.id === initialConnectionId)
      ?.status === "connected"
  )
  const [validation, setValidation] = useState<ValidationState>(
    existingBinding ? "valid" : "idle"
  )
  const [connectionEditorOpen, setConnectionEditorOpen] = useState(false)

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
  const selectedConnection = connections.find(
    (connection) => connection.id === connectionId
  )
  const isDirty =
    !existingBinding ||
    connectionId !== existingBinding.connectionId ||
    query !== existingBinding.query ||
    step !== existingBinding.step ||
    syncInterval !== existingBinding.syncInterval
  const previewPoints = metric.environment.history.slice(-3)

  function invalidate() {
    setValidation("idle")
  }

  function selectConnection(nextConnectionId: string) {
    setConnectionId(nextConnectionId)
    setConnectionTested(
      connections.find((connection) => connection.id === nextConnectionId)
        ?.status === "connected"
    )
    invalidate()
  }

  function testConnection() {
    if (!selectedConnection) return
    setConnectionTested(true)
    toast.success(t("releaseHealth.connections.editor.testPassed"))
  }

  function validate() {
    if (!query.trim() || !connectionTested) return
    setValidation("valid")
    toast.success(t("releaseHealth.metrics.sourceBinding.validationPassed"))
  }

  function save() {
    if (validation !== "valid" || !isDirty) return
    toast.success(t("releaseHealth.metrics.sourceBinding.savedPreview"))
    navigate(detailPath)
  }

  function saveConnection(connection: MetricSourceConnection) {
    setConnections((current) => [...current, connection])
    setConnectionId(connection.id)
    setConnectionTested(true)
    invalidate()
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <DetailBackLink to={detailPath}>
        {metricSampleText(t, metric, "name")}
      </DetailBackLink>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t(
              isManage
                ? "releaseHealth.metrics.sourceBinding.manageTitle"
                : "releaseHealth.metrics.sourceBinding.title"
            )}
          </h1>
          {isManage ? (
            <Badge variant="secondary">
              r{existingBinding?.bindingRevision}
            </Badge>
          ) : null}
        </div>
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
        <ContextCard
          label={t("releaseHealth.metrics.sourceBinding.metric")}
          title={metricSampleText(t, metric, "name")}
          code={`${metric.key} · v${metric.version}`}
          help={metricResultProfileLabel(t, metric)}
        />
        <ContextCard
          label={t("releaseHealth.metrics.sourceBinding.environment")}
          title={environmentName}
          code={environmentKey}
          help={t("releaseHealth.metrics.sourceBinding.environmentIsolation")}
        />
      </div>

      <div className="space-y-4">
        <StepCard
          number={1}
          title={t("releaseHealth.metrics.sourceBinding.providerStep")}
          description={t(
            "releaseHealth.metrics.sourceBinding.providerStepHelp"
          )}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("releaseHealth.connections.provider")}</Label>
              <div className="flex min-h-10 items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                <span className="text-sm font-medium">
                  Prometheus-compatible
                </span>
                <Badge variant="secondary">Pull · MVP</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="metric-source-connection">
                  {t("releaseHealth.metrics.sourceBinding.connection")}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConnectionEditorOpen(true)}
                >
                  <Plus />
                  {t("releaseHealth.metrics.sourceBinding.createConnection")}
                </Button>
              </div>
              <Select
                value={connectionId}
                onValueChange={(value) => value && selectConnection(value)}
              >
                <SelectTrigger id="metric-source-connection" className="w-full">
                  <SelectValue>
                    {selectedConnection?.name ??
                      t("releaseHealth.metrics.sourceBinding.chooseConnection")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {connections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/10 p-4">
            <div>
              <p className="text-sm font-medium">
                {selectedConnection?.name ?? "—"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {selectedConnection?.endpoint ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {connectionTested ? (
                <Badge variant="secondary">
                  <CheckCircle2 />
                  {t("releaseHealth.connections.statusValue.connected")}
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={!selectedConnection}
                onClick={testConnection}
              >
                <Play />
                {t("releaseHealth.connections.test")}
              </Button>
            </div>
          </div>
        </StepCard>

        <StepCard
          number={2}
          title={t("releaseHealth.metrics.sourceBinding.queryStep")}
          description={t("releaseHealth.metrics.sourceBinding.queryStepHelp")}
        >
          <div className="space-y-2">
            <Label htmlFor="metric-promql">PromQL</Label>
            <Textarea
              id="metric-promql"
              value={query}
              rows={6}
              className="font-mono text-xs leading-5"
              onChange={(event) => {
                setQuery(event.target.value)
                invalidate()
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("releaseHealth.metrics.sourceBinding.queryResponsibility")}
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ReadOnlyField
              label={t("releaseHealth.metrics.sourceBinding.queryMode")}
              value="query_range · range"
            />
            <SelectConfigField
              id="metric-source-step"
              label={t("releaseHealth.metrics.sourceBinding.step")}
              value={step}
              options={["1m", "5m", "15m"]}
              onValueChange={(value) => {
                setStep(value as StepValue)
                invalidate()
              }}
            />
            <SelectConfigField
              id="metric-source-sync"
              label={t("releaseHealth.metrics.sourceBinding.syncInterval")}
              value={syncInterval}
              options={["1m", "5m"]}
              onValueChange={(value) => {
                setSyncInterval(value as SyncIntervalValue)
                invalidate()
              }}
            />
          </div>

          <div className="mt-4 rounded-md border bg-muted/20 p-4">
            <p className="text-xs leading-5">
              <span className="font-medium">
                {t("releaseHealth.metrics.sourceBinding.expectedResult")}
              </span>{" "}
              {metricResultProfileLabel(t, metric)} ·{" "}
              {t("releaseHealth.resultContract.singleSeries")}
            </p>
            <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.resultSemantics")}
                </p>
                <p className="mt-1 text-sm leading-5">
                  {metric.resultSemantics}
                </p>
              </div>
              <div className="sm:min-w-32">
                <p className="text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.detail.constraints")}
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums">
                  {metric.resultContract.constraints.minimum ?? "−∞"}–
                  {metric.resultContract.constraints.maximum ?? "∞"}
                </p>
              </div>
            </div>
          </div>
        </StepCard>

        <StepCard
          number={3}
          title={t("releaseHealth.metrics.sourceBinding.validationStep")}
          description={t(
            "releaseHealth.metrics.sourceBinding.validationStepHelp"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <div>
              <p className="text-sm font-medium">
                {validation === "valid"
                  ? t("releaseHealth.metrics.sourceBinding.previewReady")
                  : t("releaseHealth.metrics.sourceBinding.previewPending")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {validation === "valid"
                  ? t("releaseHealth.metrics.sourceBinding.previewSummary", {
                      points: metric.environment.history.length,
                      unit: metricUnitLabel(t, metric.resultContract.unit),
                    })
                  : t("releaseHealth.metrics.sourceBinding.previewInstruction")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!query.trim() || !connectionTested}
              onClick={validate}
            >
              <Play />
              {t("releaseHealth.metrics.sourceBinding.validate")}
            </Button>
          </div>

          {validation === "valid" ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <ValidationFact
                  label={t("releaseHealth.metrics.sourceBinding.queryTime")}
                  value="284 ms"
                />
                <ValidationFact
                  label={t("releaseHealth.metrics.sourceBinding.previewRange")}
                  value={t("releaseHealth.metrics.detail.lastHour")}
                />
                <ValidationFact
                  label={t("releaseHealth.metrics.sourceBinding.seriesCount")}
                  value="1"
                />
                <ValidationFact
                  label={t("releaseHealth.metrics.sourceBinding.pointCount")}
                  value={String(metric.environment.history.length)}
                />
              </div>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("releaseHealth.metrics.sourceBinding.timestamp")}
                      </TableHead>
                      <TableHead>
                        {t(
                          "releaseHealth.metrics.sourceBinding.normalizedValue"
                        )}
                      </TableHead>
                      <TableHead>{t("releaseHealth.metrics.unit")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewPoints.map((point) => (
                      <TableRow key={point.timestamp}>
                        <TableCell className="font-mono text-xs">
                          {point.timestamp}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatMetricValue(metric, point.value)}
                        </TableCell>
                        <TableCell>
                          {metricUnitLabel(t, metric.resultContract.unit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </StepCard>

        <StepCard
          number={4}
          title={t("releaseHealth.metrics.sourceBinding.reviewStep")}
          description={t("releaseHealth.metrics.sourceBinding.reviewStepHelp")}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReviewFact
              label={t("releaseHealth.metrics.sourceBinding.connection")}
              value={selectedConnection?.name ?? "—"}
            />
            <ReviewFact
              label={t("releaseHealth.metrics.sourceBinding.resultContract")}
              value={metricResultProfileLabel(t, metric)}
            />
            <ReviewFact
              label={t("releaseHealth.metrics.sourceBinding.schedule")}
              value={`${step} step · ${syncInterval} sync`}
            />
            <ReviewFact
              label={t("releaseHealth.metrics.sourceBinding.validation")}
              value={
                validation === "valid"
                  ? t("releaseHealth.metrics.sourceBinding.validated")
                  : t("releaseHealth.metrics.sourceBinding.notValidated")
              }
            />
          </div>
          <Alert className="mt-4">
            <Clock3 />
            <AlertDescription>
              {t("releaseHealth.metrics.sourceBinding.collectingNotice")}
            </AlertDescription>
          </Alert>
        </StepCard>
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

      <SourceConnectionSheet
        open={connectionEditorOpen}
        onOpenChange={setConnectionEditorOpen}
        environmentKey={environmentKey}
        environmentName={environmentName}
        onSaved={saveConnection}
      />
    </div>
  )
}

function ContextCard({
  label,
  title,
  code,
  help,
}: {
  label: string
  title: string
  code: string
  help: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-medium">{title}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{code}</p>
        <p className="mt-2 text-xs text-muted-foreground">{help}</p>
      </CardContent>
    </Card>
  )
}

function StepCard({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
            {number}
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="min-h-10 rounded-md border bg-muted/20 px-3 py-2 text-sm">
        {value}
      </div>
    </div>
  )
}

function SelectConfigField({
  id,
  label,
  value,
  options,
  onValueChange,
}: {
  id: string
  label: string
  value: string
  options: string[]
  onValueChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function ValidationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  )
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
