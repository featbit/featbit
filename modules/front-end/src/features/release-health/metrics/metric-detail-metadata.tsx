import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Cable } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type { LiveMetric, LiveTrend } from "../release-health-api"
import {
  metricResultProfileLabel,
  metricUnitLabel,
  resultContractRange,
} from "./metric-contract"

export function MetricDetailContract({
  metric,
  editAction,
}: {
  metric: LiveMetric
  editAction: ReactNode
}) {
  const { t } = useTranslation()
  const d = (key: string) => t(`releaseHealth.live.detail.${key}`)
  const intrinsic = resultContractRange(metric.resultContract.unit)
  const minimum = metric.resultContract.constraints.minimum ?? intrinsic.minimum
  const maximum = metric.resultContract.constraints.maximum ?? intrinsic.maximum
  return (
    <Card
      role="region"
      aria-labelledby="metric-contract-heading"
      className="gap-3"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <h2 id="metric-contract-heading">{d("contract")}</h2>
        </CardTitle>
        {editAction}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="mb-1 text-xs text-muted-foreground">
            {d("semantics")}
          </h3>
          <p className="text-sm leading-5 break-words">
            {metric.resultSemantics}
          </p>
        </div>
        <dl className="space-y-2">
          <Definition label={d("kind")}>
            {t(
              `releaseHealth.resultContract.measurementKind.${metric.resultContract.measurementKind}`
            )}
          </Definition>
          <Definition label={d("unit")}>
            {metricUnitLabel(t, metric.resultContract.unit)}
          </Definition>
        </dl>
        <section className="border-t pt-3">
          <h3 className="mb-2 text-xs font-medium">{d("shape")}</h3>
          <dl className="space-y-2">
            <Definition label={d("resultKind")}>
              {d("numericSeries")}
            </Definition>
            <Definition label={d("cardinality")}>{d("single")}</Definition>
            <Definition label={d("profile")}>
              {metricResultProfileLabel(t, metric)}
            </Definition>
          </dl>
        </section>
        <section className="border-t pt-3">
          <h3 className="mb-2 text-xs font-medium">{d("constraints")}</h3>
          <dl className="grid grid-cols-3 gap-2">
            {[
              ["minimum", minimum],
              ["maximum", maximum],
              ["digits", metric.fractionDigits ?? 2],
            ].map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">
                  {d(String(key))}
                </dt>
                <dd className="mt-1 text-sm font-medium tabular-nums">
                  {value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {d("validityHelp")}
          </p>
        </section>
      </CardContent>
    </Card>
  )
}

export function MetricDetailSource({
  metric,
  context,
  source,
  connected,
  pending,
  failed,
  canConfigure,
}: {
  metric: LiveMetric
  context: ProjectEnv
  source: LiveTrend["source"]
  connected: boolean
  pending: boolean
  failed: boolean
  canConfigure: boolean
}) {
  const { t } = useTranslation()
  const d = (key: string) => t(`releaseHealth.live.detail.${key}`)
  const lang = resolveLang(useParams().lang)
  return (
    <Card
      role="region"
      aria-labelledby="metric-source-heading"
      className="gap-3"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <h2 id="metric-source-heading">{d("source")}</h2>
        </CardTitle>
        <Button
          nativeButton={false}
          variant={connected || failed ? "outline" : "default"}
          size="sm"
          disabled={!canConfigure || pending}
          render={
            <Link
              to={localizedPath(
                lang,
                `/release-health/metrics/${encodeURIComponent(metric.key)}/source-bindings/${encodeURIComponent(context.envKey)}`
              )}
            />
          }
        >
          <Cable />
          {d(connected || failed ? "manage" : "connect")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t("releaseHealth.live.detail.sourceHelp", {
            environment: context.envName,
          })}
        </p>
        {source ? (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium break-words">
                {source.connectionName}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  `releaseHealth.connections.editor.providers.${source.providerType}.name`,
                  { defaultValue: source.providerType }
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
              <span>
                <span className="text-muted-foreground">{d("sampleStep")}</span>{" "}
                <span className="font-medium tabular-nums">{source.step}</span>
              </span>
              <span className="text-muted-foreground">{d("onDemand")}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {d(
              pending
                ? "loading"
                : failed
                  ? "sourceUnavailable"
                  : "notConnected"
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Definition({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs leading-5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  )
}
