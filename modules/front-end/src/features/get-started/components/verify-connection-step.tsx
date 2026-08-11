import { CheckCircle2, CircleAlert, Clock3, RefreshCw } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { fetchFeatureFlagInsights } from "@/features/flags/details/insights/insights-api"
import { getSdkDefinition } from "../sdk-definitions"
import type { GetStartedFlag, SdkId } from "../get-started-types"
import { formatDuration, hasEvaluationEvents } from "../get-started-utils"
import { CopyButton } from "./copy-button"

const MONITORING_WINDOW_MS = 120_000
const POLL_INTERVAL_MS = 5_000

type VerificationStatus = "listening" | "timeout"

export function VerifyConnectionStep({
  envId,
  flag,
  sdkId,
  onBack,
  onExit,
}: {
  envId: string
  flag: GetStartedFlag
  sdkId: SdkId
  onBack: () => void
  onExit: () => void
}) {
  const { t } = useTranslation()
  const sdk = getSdkDefinition(sdkId)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [status, setStatus] = useState<VerificationStatus>("listening")
  const insightsQuery = useQuery({
    queryKey: ["get-started", "verification", envId, flag.key, startedAt],
    queryFn: () =>
      fetchFeatureFlagInsights(envId, {
        featureFlagKey: flag.key,
        intervalType: "MINUTE",
        from: startedAt,
        to: Date.now(),
      }),
    enabled: Boolean(envId && flag.key && status === "listening"),
    refetchInterval: (query) =>
      status === "listening" && !hasEvaluationEvents(query.state.data ?? [])
        ? POLL_INTERVAL_MS
        : false,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const eventDetected = hasEvaluationEvents(insightsQuery.data ?? [])
  const effectiveStatus = eventDetected ? "success" : status

  useEffect(() => {
    if (status !== "listening" || eventDetected) return

    function updateClock() {
      const nextNow = Date.now()
      setNow(nextNow)
      if (nextNow - startedAt >= MONITORING_WINDOW_MS) {
        setStatus("timeout")
      }
    }

    updateClock()
    const interval = window.setInterval(updateClock, 250)
    return () => window.clearInterval(interval)
  }, [eventDetected, startedAt, status])

  const elapsedMs = Math.min(Math.max(now - startedAt, 0), MONITORING_WINDOW_MS)
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const remainingSeconds = Math.ceil((MONITORING_WINDOW_MS - elapsedMs) / 1000)
  const progress = (elapsedMs / MONITORING_WINDOW_MS) * 100
  const lastChecked = useMemo(() => {
    const updatedAt = Math.max(
      insightsQuery.dataUpdatedAt,
      insightsQuery.errorUpdatedAt
    )
    if (!updatedAt) return t("getStarted.verify.notCheckedYet")
    const secondsAgo = Math.max(0, Math.floor((now - updatedAt) / 1000))
    return secondsAgo < 10
      ? t("getStarted.verify.justNow")
      : t("getStarted.verify.ago", {
          duration: formatDuration(secondsAgo),
        })
  }, [insightsQuery.dataUpdatedAt, insightsQuery.errorUpdatedAt, now, t])

  function retry() {
    const nextStart = Date.now()
    setStartedAt(nextStart)
    setNow(nextStart)
    setStatus("listening")
  }

  const connectionLabel =
    effectiveStatus === "success"
      ? t("getStarted.verify.statuses.connected")
      : effectiveStatus === "timeout"
        ? t("getStarted.verify.statuses.notDetected")
        : t("getStarted.verify.statuses.listening")

  return (
    <section className="flex min-h-[38rem] flex-col rounded-lg border bg-card">
      <header className="px-5 pt-5">
        <h2
          data-get-started-step-heading
          tabIndex={-1}
          className="rounded-sm text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {t("getStarted.verify.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("getStarted.verify.subtitle")}
        </p>
      </header>

      <div className="flex-1 space-y-5 px-5 py-5">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            {t("getStarted.verify.connection")}
          </h3>
          <div className="flex min-h-36 items-center gap-2 rounded-lg border px-6 py-5">
            <div className="flex min-h-20 w-44 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/20 px-4 text-center">
              <span className="text-sm font-semibold">
                {t("getStarted.verify.yourApp")}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                {sdk.label}{" "}
                {t(`getStarted.common.${sdk.recommendedSecretType}`)}
              </span>
            </div>
            <div className="relative h-6 min-w-24 flex-1 px-2">
              <div className="absolute inset-x-2 top-1/2 border-t-2 border-dotted border-slate-300 dark:border-slate-600" />
              <span
                className={`absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-background ${
                  effectiveStatus === "success"
                    ? "bg-green-600"
                    : effectiveStatus === "timeout"
                      ? "bg-destructive"
                      : "bg-amber-500"
                }`}
              />
              <span className="absolute inset-x-0 top-1/2 mt-2 text-center text-xs text-muted-foreground">
                {connectionLabel}
              </span>
            </div>
            <div className="flex min-h-20 w-44 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/20 px-4 text-center">
              <span className="text-sm font-semibold">FeatBit</span>
              <span className="mt-1 text-sm text-muted-foreground">
                {t("getStarted.verify.evaluationService")}
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-h-14 items-center gap-3 rounded-lg border px-4 py-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
          <span className="text-sm font-medium">
            {t("getStarted.verify.watchingFlag")}
          </span>
          <code className="min-w-0 truncate text-sm text-muted-foreground">
            {flag.key}
          </code>
          <CopyButton value={flag.key} />
        </div>

        {effectiveStatus === "listening" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/70 dark:bg-amber-950/20">
            <div className="flex gap-3">
              <span className="mt-0.5 size-5 shrink-0 rounded-full border-[3px] border-amber-500" />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">
                  {t("getStarted.verify.listeningTitle")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {insightsQuery.isError
                    ? t("getStarted.verify.checkFailed")
                    : t("getStarted.verify.listeningDescription")}
                </p>
                <div className="mt-5">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                  >
                    <div
                      className="h-full rounded-full bg-amber-500 transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-xs text-muted-foreground tabular-nums">
                    <span>
                      {t("getStarted.verify.elapsed", {
                        duration: formatDuration(elapsedSeconds),
                      })}
                    </span>
                    <span>
                      {t("getStarted.verify.remaining", {
                        duration: formatDuration(remainingSeconds),
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {effectiveStatus === "success" ? (
          <Alert className="border-green-200 bg-green-50/50 dark:border-green-900/70 dark:bg-green-950/20">
            <CheckCircle2 className="text-green-600 dark:text-green-500" />
            <AlertTitle>{t("getStarted.verify.successTitle")}</AlertTitle>
            <AlertDescription>
              <Trans
                i18nKey="getStarted.verify.successDescription"
                values={{ flagKey: flag.key }}
                components={{ code: <code /> }}
              />
            </AlertDescription>
          </Alert>
        ) : null}

        {effectiveStatus === "timeout" ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{t("getStarted.verify.timeoutTitle")}</AlertTitle>
            <AlertDescription>
              {t("getStarted.verify.timeoutDescription")}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="size-4" />
            {t("getStarted.verify.checksEvery")}
          </span>
          <span className="inline-flex items-center gap-2">
            <RefreshCw
              className={`size-4 ${insightsQuery.isFetching ? "animate-spin" : ""}`}
            />
            {t("getStarted.verify.lastChecked", { value: lastChecked })}
          </span>
        </div>
      </div>

      <footer className="flex min-h-16 items-center justify-between border-t bg-muted/10 px-5 py-3">
        <Button type="button" variant="outline" onClick={onBack}>
          {effectiveStatus === "success" || effectiveStatus === "timeout"
            ? t("getStarted.verify.backToSdk")
            : t("getStarted.common.back")}
        </Button>
        <div className="flex items-center gap-2">
          {effectiveStatus === "timeout" ? (
            <Button type="button" variant="ghost" onClick={onExit}>
              {t("getStarted.common.skip")}
            </Button>
          ) : null}
          {effectiveStatus === "timeout" ? (
            <Button type="button" onClick={retry}>
              {t("getStarted.common.retry")}
            </Button>
          ) : effectiveStatus === "success" ? (
            <Button type="button" onClick={onExit}>
              {t("getStarted.verify.viewFeatureFlags")}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onExit}>
              {t("getStarted.common.skip")}
            </Button>
          )}
        </div>
      </footer>
    </section>
  )
}
