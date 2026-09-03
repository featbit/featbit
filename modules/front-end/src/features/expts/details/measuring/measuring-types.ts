import type { ExperimentRunDetail } from "../experiment-details-types"

export type AnalysisMethod = "bayesian_ab" | "bandit"

export type NewRunSetup = {
  method: AnalysisMethod
  controlVariant: string
  treatmentVariant: string
}

export type ObservationWindowUpdate = {
  observationStart: string
  observationEnd: string | null
}

export type MeasuringRun = ExperimentRunDetail & {
  hypothesis?: string | null
  methodReason?: string | null
  primaryMetricEvent?: string | null
  metricDescription?: string | null
  guardrailEvents?: string | null
  guardrailDescriptions?: string | null
  controlVariant?: string | null
  treatmentVariant?: string | null
  trafficAllocation?: string | null
  minimumSample?: number | null
  observationStart?: string | null
  observationEnd?: string | null
  priorProper?: boolean
  priorMean?: number | null
  priorStddev?: number | null
  inputData?: string | null
  analysisResult?: string | null
  primaryMetricAgg?: string | null
  primaryMetricType?: string | null
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
  audienceFilters?: string | null
  trafficOffset?: number | null
  updatedAt?: string
}

export type RunAssignmentUpdate = {
  method?: string | null
  controlVariant: string
  treatmentVariant: string
  layerKey: string | null
  assignmentUnitSelector: string
  sliceStart: number
  sliceEnd: number
  analysisSamplingPlan: string
  audienceFilters: string | null
}

export type AnalysisRow = {
  variant: string
  n: number
  conversions?: number
  rate?: number
  mean?: number
  relDelta?: number
  ciLower?: number
  ciUpper?: number
  signalLabel?: "pWin" | "pHarm"
  signal?: number
  pBest?: number
  recommendedWeight?: number
}

export type AnalysisSection = {
  label: string
  rows: AnalysisRow[]
  verdict?: string
}

export type ParsedAnalysis = {
  type: "bandit" | "bayesian" | "unknown"
  computedAt?: string
  algorithm?: string
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
  enoughUnits?: boolean
  stopping?: { met?: boolean; threshold?: number; message?: string }
}

export type AudienceFilter = {
  property: string
  op: "eq" | "neq" | "in" | "nin"
  value: string
}
