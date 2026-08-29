import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  DataStatus,
  GateStatus,
  HealthStatus,
  MetricObservationScope,
  MonitorPurpose,
} from "../release-health-types"

const dataDots: Record<DataStatus, string> = {
  collecting: "bg-blue-500",
  ready: "bg-emerald-600",
  "no-data": "bg-muted-foreground",
  stale: "bg-amber-500",
  error: "bg-destructive",
}

const healthDots: Record<HealthStatus, string> = {
  healthy: "bg-emerald-600",
  warning: "bg-amber-500",
  critical: "bg-destructive",
  "not-evaluated": "bg-muted-foreground",
}

const gateDots: Record<GateStatus, string> = {
  waiting: "bg-blue-500",
  passing: "bg-emerald-600",
  breached: "bg-destructive",
  "approval-required": "bg-amber-500",
}

function DotBadge({
  dotClassName,
  children,
}: {
  dotClassName: string
  children: React.ReactNode
}) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn("size-1.5 rounded-full", dotClassName)} />
      {children}
    </Badge>
  )
}

export function DataStatusBadge({ status }: { status: DataStatus }) {
  const { t } = useTranslation()
  return (
    <DotBadge dotClassName={dataDots[status]}>
      {t(`releaseHealth.status.data.${status}`)}
    </DotBadge>
  )
}

export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const { t } = useTranslation()
  return (
    <DotBadge dotClassName={healthDots[status]}>
      {t(`releaseHealth.status.health.${status}`)}
    </DotBadge>
  )
}

export function GateStatusBadge({ status }: { status: GateStatus }) {
  const { t } = useTranslation()
  return (
    <DotBadge dotClassName={gateDots[status]}>
      {t(`releaseHealth.status.gate.${status}`)}
    </DotBadge>
  )
}

export function PurposeBadge({ purpose }: { purpose: MonitorPurpose }) {
  const { t } = useTranslation()
  return (
    <Badge variant={purpose === "guard" ? "secondary" : "outline"}>
      {t(`releaseHealth.purpose.${purpose}`)}
    </Badge>
  )
}

export function ObservationScopeBadge({
  scope,
}: {
  scope: MetricObservationScope
}) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className="font-normal">
      {t(`releaseHealth.scope.${scope}`)}
    </Badge>
  )
}
