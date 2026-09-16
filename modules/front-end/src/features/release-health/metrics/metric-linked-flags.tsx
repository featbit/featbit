import { useQueries, type UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fetchFeatureFlag } from "@/features/flags/flags-api"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type { MetricMonitorBinding } from "../release-health-api"
import { MetricDetailTable } from "./metric-detail-table"

export function MetricLinkedFlags({
  context,
  bindings,
}: {
  context: ProjectEnv
  bindings: UseQueryResult<MetricMonitorBinding[], Error>
}) {
  const { t } = useTranslation()
  const d = (key: string) => t(`releaseHealth.live.detail.${key}`)
  const lang = resolveLang(useParams().lang)
  const grouped = new Map<
    string,
    { flagKey: string; createdAt: number | null }
  >()
  for (const binding of bindings.data ?? []) {
    if (binding.status === "deleted") continue
    const time = Date.parse(binding.createdAt ?? "")
    const createdAt = Number.isFinite(time) ? time : null
    const previous = grouped.get(binding.flagId)
    grouped.set(binding.flagId, {
      flagKey: binding.flagKey,
      createdAt: previous
        ? previous.createdAt === null || createdAt === null
          ? null
          : Math.min(previous.createdAt, createdAt)
        : createdAt,
    })
  }
  const links = [...grouped.values()]
  const flags = useQueries({
    queries: links.map(({ flagKey }) => ({
      queryKey: ["feature-flag-details", context.envId, flagKey],
      queryFn: () => fetchFeatureFlag(context.envId, flagKey),
      retry: false,
    })),
  })
  const pending = bindings.isPending || flags.some((flag) => flag.isPending)
  const failed = bindings.isError || flags.some((flag) => flag.isError)
  const rows =
    pending || failed
      ? []
      : links.flatMap((binding, index) => {
          const flag = flags[index].data
          if (!flag) return []
          const path = `/feature-flags/${encodeURIComponent(flag.key)}`
          return [
            {
              id: flag.id,
              cells: [
                <span className="font-medium">{flag.name}</span>,
                <code className="text-xs text-muted-foreground">
                  {flag.key}
                </code>,
                <Badge variant={flag.isEnabled ? "default" : "secondary"}>
                  {d(flag.isEnabled ? "flagEnabled" : "flagDisabled")}
                </Badge>,
                binding.createdAt === null ? (
                  <span className="text-muted-foreground">{d("unknown")}</span>
                ) : (
                  <time dateTime={new Date(binding.createdAt).toISOString()}>
                    {new Date(binding.createdAt).toLocaleString(
                      lang === "zh" ? "zh-CN" : "en-US"
                    )}
                  </time>
                ),
                <div className="flex items-center justify-end gap-4">
                  <Link
                    className="text-sm underline-offset-4 hover:underline"
                    to={localizedPath(lang, `${path}/targeting`)}
                  >
                    {d("openFlag")}
                  </Link>
                  <Link
                    className="text-sm underline-offset-4 hover:underline"
                    to={localizedPath(
                      lang,
                      `${path}/release-health#metric-bindings`
                    )}
                  >
                    {d("openMonitoring")}
                  </Link>
                </div>,
              ],
            },
          ]
        })

  return (
    <Card role="region" aria-labelledby="metric-flags-heading">
      <CardHeader>
        <CardTitle>
          <h2 id="metric-flags-heading">{d("linkedFlags")}</h2>
        </CardTitle>
        <CardDescription>
          {t("releaseHealth.live.detail.linkedFlagsHelp", {
            environment: context.envName,
          })}
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          {t("releaseHealth.live.detail.timezone", {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })}
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <MetricDetailTable
          headings={["flagName", "flagKey", "flagState", "boundAt", "open"].map(
            d
          )}
          alignLast
          rows={rows}
          empty={
            failed ? (
              <div role="alert" className="space-y-2 py-4">
                <p>{d("linkedFlagsUnavailable")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void bindings.refetch()
                    flags.forEach((flag) => {
                      if (flag.isError) void flag.refetch()
                    })
                  }}
                >
                  {d("retry")}
                </Button>
              </div>
            ) : pending ? (
              d("loading")
            ) : (
              <div className="space-y-1 py-4">
                <p>
                  {t("releaseHealth.live.detail.noLinkedFlags", {
                    environment: context.envName,
                  })}
                </p>
                <p className="text-xs">{d("linkedFlagsEmptyHelp")}</p>
              </div>
            )
          }
        />
      </CardContent>
    </Card>
  )
}
