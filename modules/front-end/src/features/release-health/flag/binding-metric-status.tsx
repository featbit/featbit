import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { DataStatusBadge } from "../components/status-badges"
import type { BindingMetric } from "./monitor-data"

export function BindingMetricStatus({ metric }: { metric: BindingMetric }) {
  const { t } = useTranslation()
  return metric.dataStatus === "loading" ||
    metric.dataStatus === "not-connected" ? (
    <Badge variant="outline">
      {t(
        `releaseHealth.binding.${metric.dataStatus === "loading" ? "loading" : "notConnected"}`
      )}
    </Badge>
  ) : (
    <DataStatusBadge status={metric.dataStatus} />
  )
}
