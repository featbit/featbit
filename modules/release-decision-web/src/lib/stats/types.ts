/**
 * Shared types for the Bayesian analysis pipeline.
 */

/** Gaussian prior on the relative effect δ = (mean_b − mean_a) / mean_a. */
export interface GaussianPrior {
  mean: number;
  variance: number;
  proper: boolean;
}

/** Result of a single-variant Bayesian comparison. */
export interface BayesianResult {
  error: string | null;
  chance_to_win: number;
  relative_change: number;
  absolute_change: number;
  ci_rel_lower: number;
  ci_rel_upper: number;
  risk_ctrl: number;
  risk_trt: number;
  prior_applied: boolean;
}

/** One row in the metric section output. */
export interface MetricRow {
  variant: string;
  n: number;
  is_control: boolean;
  conversions?: number;
  rate?: number;
  mean?: number;
  rel_delta?: number;
  ci_lower?: number;
  ci_upper?: number;
  p_win?: number;
  p_harm?: number;
  risk_ctrl?: number;
  risk_trt?: number;
}

/** Structured output for one metric. */
export interface MetricSection {
  event: string;
  metric_type: "proportion" | "continuous";
  metric_agg?: "once" | "count" | "sum" | "average";
  inverse?: boolean;
  rows: MetricRow[];
  verdict: string;
}

/** SRM check result. */
export interface SrmResult {
  chi2_p_value: number;
  ok: boolean;
  observed: Record<string, number>;
}

/** Sample-size check result. */
export interface SampleCheck {
  minimum_per_variant: number;
  ok: boolean;
  variants: Record<string, number>;
}

/** Full analysis output (matches Python analyze-bayesian.py output). */
export interface AnalysisOutput {
  type: "bayesian";
  experiment: string;
  computed_at: string;
  window: { start?: string; end?: string };
  control: string;
  treatments: string[];
  prior: string;
  srm: SrmResult;
  primary_metric: MetricSection | null;
  guardrails: MetricSection[];
  sample_check: SampleCheck;
  warnings?: string[];
}

/** Binary variant data from TSDB. */
export interface BinaryVariantData {
  n: number;
  k: number;
}

/** Continuous variant data from TSDB. */
export interface ContinuousVariantData {
  n: number;
  mean: number;
  variance: number;
  total?: number;
}

/** Union of variant data shapes. */
export type VariantData = BinaryVariantData | ContinuousVariantData;

/** TSDB query response. */
export interface TsdbQueryResponse {
  metricType: string;
  variants: Record<string, TsdbVariantStats>;
}

export type TsdbManyQueryResponse = Record<string, TsdbQueryResponse>;

export interface TsdbVariantStats {
  n: number;
  k?: number;
  mean?: number;
  variance?: number;
  total?: number;
}

/** Metric summary ready for analysis. */
export interface MetricSummary {
  metricType: string;
  control: VariantData;
  treatment: VariantData;
}

/** Request payload for the /analyze endpoint. */
export interface AnalyzeRequest {
  slug?: string;
  projectId?: string;
  experimentId?: string;
  envId: string;
  flagKey: string;
  method?: string;
  layerId?: string;
  trafficPercent?: number;
  trafficOffset?: number;
  audienceFilters?: string;
  primaryMetricEvent: string;
  primaryMetricType?: string;
  primaryMetricAgg?: string;
  controlVariant?: string;
  treatmentVariant?: string;
  observationStart?: string;
  observationEnd?: string;
  priorProper?: boolean;
  priorMean?: number;
  priorStddev?: number;
  minimumSample?: number;
  guardrailEvents?: string;
}
