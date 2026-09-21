import type { ExperimentRunDetail } from "../experiment-details-types"
import type {
  GuardrailMetricConfig,
  PrimaryMetricConfig,
} from "../metric-config-types"

export type AnalysisMethod = "bayesian_ab"

export type NewRunSetup = {
  method: AnalysisMethod
  controlVariant: string
  treatmentVariants: string[]
  minimumSample: number
}

export type ObservationWindowUpdate = {
  observationStart: string
  observationEnd: string | null
}

export type MeasuringRun = ExperimentRunDetail & {
  primaryMetric?: PrimaryMetricConfig | null
  guardrailMetrics?: GuardrailMetricConfig[]
  controlVariant?: string | null
  treatmentVariants?: string[] | null
  minimumSample?: number | null
  priorProper?: boolean
  priorMean?: number | null
  priorStddev?: number | null
  analysisResult?: string | null
  trafficPercent?: number | null
  layerId?: string | null
  layerKey?: string | null
  allocationKeySelector?: string | null
  sliceStart?: number | null
  sliceEnd?: number | null
  allocationPlan?: string | null
  assignmentUnitSelector?: string | null
  layerTrafficPercent?: number | null
  analysisSamplingPlan?: string | null
  trafficOffset?: number | null
  updatedAt?: string
}

export type RunAssignmentUpdate = {
  method?: string | null
  controlVariant: string
  treatmentVariants: string[]
  layerKey: string | null
  assignmentUnitSelector: string
  sliceStart: number
  sliceEnd: number
  analysisSamplingPlan: string
}

export type AnalysisRow = {
  variant: string
  n: number
  isControl?: boolean
  conversions?: number
  rate?: number
  mean?: number
  relDelta?: number
  ciLower?: number
  ciUpper?: number
  signalLabel?: "pWin" | "pHarm"
  signal?: number
}

export type AnalysisSection = {
  label: string
  event?: string
  inverse?: boolean
  metricType?: string
  metricAgg?: string
  rows: AnalysisRow[]
  verdict?: string
}

export type ParsedAnalysis = {
  type: "bayesian" | "unknown"
  computedAt?: string
  window?: { start: string | null; end: string | null }
  prior?: string
  srm?: {
    pValue?: number
    ok?: boolean
    observed: Record<string, number>
  }
  sampleCheck?: {
    minimum: number
    ok: boolean
    variants: Record<string, number>
  }
  primary?: AnalysisSection
  guardrails: AnalysisSection[]
}
