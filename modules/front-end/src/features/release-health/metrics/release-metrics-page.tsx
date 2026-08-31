import { Info, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { MetricDefinitionSheet } from "../components/metric-definition-sheet"
import { ReleaseHealthShell } from "../components/release-health-shell"
import { DataStatusBadge } from "../components/status-badges"
import { metricSampleText } from "../release-health-display"
import { releaseMetrics } from "../release-health-mock-data"
import type { ReleaseMetricCategory } from "../release-health-types"

export function ReleaseMetricsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<ReleaseMetricCategory | "all">("all")
  const [createOpen, setCreateOpen] = useState(false)
  const filtered = useMemo(
    () =>
      releaseMetrics.filter(
        (metric) =>
          (category === "all" || metric.category === category) &&
          (!search.trim() ||
            `${metricSampleText(t, metric, "name")} ${metric.name} ${metric.key} ${metric.environment.sourceBinding?.sourceLabel ?? ""}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()))
      ),
    [category, search, t]
  )

  return (
    <ReleaseHealthShell activeTab="metrics">
      <div className="space-y-4">
        <Alert>
          <Info />
          <AlertDescription>
            {t("releaseHealth.metrics.catalogNotice")}
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                className="pl-9"
                placeholder={t("releaseHealth.metrics.search")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              value={category}
              onValueChange={(value) =>
                value && setCategory(value as ReleaseMetricCategory | "all")
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue>
                  {category === "all"
                    ? t("releaseHealth.metrics.allCategories")
                    : t(`releaseHealth.category.${category}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {t("releaseHealth.metrics.allCategories")}
                  </SelectItem>
                  {(["impact", "quality", "reliability"] as const).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {t(`releaseHealth.category.${value}`)}
                      </SelectItem>
                    )
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("releaseHealth.metrics.add")}
          </Button>
        </div>

        <div className="grid gap-3 md:hidden">
          {filtered.map((metric) => (
            <div
              key={metric.id}
              className="rounded-md border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={localizedPath(
                      lang,
                      `/release-health/metrics/${metric.key}`
                    )}
                    className="font-medium text-foreground hover:underline"
                  >
                    {metricSampleText(t, metric, "name")}
                  </Link>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {metric.key} · v{metric.version}
                  </p>
                </div>
                <DataStatusBadge status={metric.environment.dataStatus} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">
                    {t("releaseHealth.metrics.latest")}
                  </p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {metric.environment.displayValue}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("releaseHealth.metrics.freshness")}
                  </p>
                  <p className="mt-1 text-sm">
                    {metricSampleText(t, metric, "updatedAt")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                <Badge variant="secondary" className="font-normal">
                  {t(`releaseHealth.category.${metric.category}`)}
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {t(`releaseHealth.valueType.${metric.valueType}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.monitorCount", {
                    count: metric.usedByMonitors,
                  })}
                </span>
              </div>
            </div>
          ))}
          {!filtered.length ? (
            <div className="rounded-md border py-16 text-center text-sm text-muted-foreground">
              {t("releaseHealth.metrics.empty")}
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-hidden rounded-md border bg-background md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">
                  {t("releaseHealth.metrics.metric")}
                </TableHead>
                <TableHead>{t("releaseHealth.metrics.category")}</TableHead>
                <TableHead>{t("releaseHealth.metrics.signal")}</TableHead>
                <TableHead>{t("releaseHealth.metrics.dataStatus")}</TableHead>
                <TableHead>{t("releaseHealth.metrics.latest")}</TableHead>
                <TableHead>{t("releaseHealth.metrics.usedBy")}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t("releaseHealth.metrics.freshness")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((metric) => (
                <TableRow key={metric.id}>
                  <TableCell className="pl-4">
                    <Link
                      to={localizedPath(
                        lang,
                        `/release-health/metrics/${metric.key}`
                      )}
                      className="font-medium text-foreground hover:underline"
                    >
                      {metricSampleText(t, metric, "name")}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {metric.key} · v{metric.version}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {t(`releaseHealth.category.${metric.category}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {t(`releaseHealth.valueType.${metric.valueType}`)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(`releaseHealth.calculation.${metric.calculation}`)} ·{" "}
                      {t(`releaseHealth.unit.${metric.unit}`)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <DataStatusBadge status={metric.environment.dataStatus} />
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {metric.environment.displayValue}
                  </TableCell>
                  <TableCell>
                    {t("releaseHealth.metrics.monitorCount", {
                      count: metric.usedByMonitors,
                    })}
                  </TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground">
                    {metricSampleText(t, metric, "updatedAt")}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 text-center text-muted-foreground"
                  >
                    {t("releaseHealth.metrics.empty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      <MetricDefinitionSheet open={createOpen} onOpenChange={setCreateOpen} />
    </ReleaseHealthShell>
  )
}
