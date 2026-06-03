/**
 * Bayesian A/B experiment analysis orchestrator.
 *
 * TypeScript port of agent/data/Scripts/analyze-bayesian.py.
 * Computes metric sections with verdicts for primary and guardrail metrics.
 */

import { bayesianResult, metricMoments, srmCheck } from "./bayesian";
import type {
  AnalysisOutput,
  GaussianPrior,
  MetricRow,
  MetricSection,
  SampleCheck,
  SrmResult,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// METRIC SECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute one metric block as a structured result.
 *
 * Port of compute_metric_section() from analyze-bayesian.py.
 */
export function computeMetricSection(
  label: string,
  mdata: Record<string, unknown>,
  control: string,
  treatments: string[],
  isGuardrail = false,
  prior?: GaussianPrior | null,
  metricAgg?: string,
): MetricSection | null {
  const inverse = Boolean(mdata.inverse);
  const ctrlRaw = mdata[control] as Record<string, number> | undefined;
  if (!ctrlRaw || typeof ctrlRaw !== "object") return null;

  const [meanA, varA, nA] = metricMoments(ctrlRaw);
  const isProp = "k" in ctrlRaw;
  const kind = isProp ? "proportion" : "continuous";

  const rows: MetricRow[] = [];

  // Control row
  const ctrlRow: MetricRow = { variant: control, n: nA, is_control: true };
  if (isProp) {
    ctrlRow.conversions = Math.floor(ctrlRaw.k ?? 0);
    ctrlRow.rate = round(meanA, 6);
  } else {
    ctrlRow.mean = round(meanA, 4);
  }
  rows.push(ctrlRow);

  const verdicts: string[] = [];

  for (const trt of treatments) {
    const trtRaw = mdata[trt] as Record<string, number> | undefined;
    if (!trtRaw || typeof trtRaw !== "object") continue;

    const [meanB, varB, nB] = metricMoments(trtRaw);
    const bay = bayesianResult(meanA, varA, nA, meanB, varB, nB, inverse, prior);

    const trtRow: MetricRow = { variant: trt, n: nB, is_control: false };

    if (isProp) {
      trtRow.conversions = Math.floor(trtRaw.k ?? 0);
      trtRow.rate = round(meanB, 6);
    } else {
      trtRow.mean = round(meanB, 4);
    }

    if (bay.error) {
      rows.push(trtRow);
      continue;
    }

    trtRow.rel_delta = round(bay.relative_change, 6);
    trtRow.ci_lower = round(bay.ci_rel_lower, 6);
    trtRow.ci_upper = round(bay.ci_rel_upper, 6);

    if (isGuardrail) {
      trtRow.p_harm = round(1 - bay.chance_to_win, 4);
      trtRow.risk_ctrl = round(bay.risk_ctrl, 6);
      trtRow.risk_trt = round(bay.risk_trt, 6);
    } else {
      trtRow.p_win = round(bay.chance_to_win, 4);
      trtRow.risk_ctrl = round(bay.risk_ctrl, 6);
      trtRow.risk_trt = round(bay.risk_trt, 6);
    }

    rows.push(trtRow);

    // Generate verdict
    const ctw = bay.chance_to_win;
    const prefix = treatments.length > 1 ? `${trt}: ` : "";

    if (isGuardrail) {
      const pHarm = 1 - ctw;
      if (pHarm < 0.1) {
        verdicts.push(`${prefix}guardrail healthy`);
      } else if (pHarm < 0.3) {
        verdicts.push(`${prefix}guardrail borderline — monitor`);
      } else {
        verdicts.push(`${prefix}guardrail ALARM — possible regression`);
      }
    } else {
      if (ctw >= 0.95) {
        verdicts.push(`${prefix}strong signal → adopt treatment`);
      } else if (ctw >= 0.8) {
        verdicts.push(`${prefix}leaning treatment`);
      } else if (ctw <= 0.05) {
        verdicts.push(`${prefix}treatment appears harmful`);
      } else if (ctw <= 0.2) {
        verdicts.push(`${prefix}leaning control`);
      } else {
        verdicts.push(`${prefix}inconclusive`);
      }
    }
  }

  const section: MetricSection = {
    event: label,
    metric_type: kind,
    rows,
    verdict: verdicts.length > 0 ? verdicts.join("; ") : "no data",
  };
  if (inverse) section.inverse = true;
  if (metricAgg === "once" || metricAgg === "count" || metricAgg === "sum" || metricAgg === "average") {
    section.metric_agg = metricAgg;
  }

  return section;
}

// ═══════════════════════════════════════════════════════════════════════════
// FULL ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-guardrail definition. Carries enough metadata for the analyzer to honour
 * the user's declared aggregation and direction without re-reading the
 * Experiment row. Mirrors the GuardrailDef shape produced by parseGuardrailDefs
 * in lib/data.ts.
 */
export interface GuardrailDefInput {
  event: string;
  metricType?: string;   // canonical: "binary" | "continuous"
  metricAgg?: string;    // canonical: "once" | "count" | "sum" | "average"
  inverse?: boolean;
}

export interface AnalysisInput {
  slug: string;
  metrics: Record<string, Record<string, unknown>>;
  control: string;
  treatments: string[];
  observationStart?: string | null;
  observationEnd?: string | null;
  priorProper?: boolean;
  priorMean?: number;
  priorStddev?: number;
  minimumSample?: number;
  /**
   * Rich guardrail definitions. Use this in preference to `guardrailEvents`.
   * The legacy string[] form (event names only) is still accepted for
   * back-compat — it maps to GuardrailDefInput[] with default binary/once.
   */
  guardrails?: GuardrailDefInput[] | null;
  /** @deprecated pass `guardrails` instead. */
  guardrailEvents?: string[] | null;
  primaryMetricAgg?: string;
}

/**
 * Run the full Bayesian analysis. Replaces both Python script + .NET orchestration.
 *
 * Input: same shape as PythonAnalysisInput from the .NET code.
 * Output: same JSON shape as analyze-bayesian.py's output.
 */
export function runAnalysis(input: AnalysisInput): AnalysisOutput {
  const {
    slug,
    metrics,
    control,
    treatments,
    observationStart,
    observationEnd,
    priorProper = false,
    priorMean = 0,
    priorStddev = 0.3,
    minimumSample = 0,
    guardrails: guardrailDefsIn,
    guardrailEvents,
    primaryMetricAgg,
  } = input;

  // Normalise both call shapes to GuardrailDefInput[]. Legacy callers passed
  // string[] (event names only); the new path passes the rich GuardrailDef[].
  const guardrailDefs: GuardrailDefInput[] = guardrailDefsIn
    ?? (guardrailEvents ?? []).map((event) => ({ event }));

  // Build prior
  const prior: GaussianPrior = {
    mean: priorMean,
    variance: priorStddev ** 2,
    proper: priorProper,
  };

  const priorLabel = priorProper
    ? `Gaussian(μ=${priorMean}, σ=${priorStddev})`
    : "flat (improper)";

  // SRM check
  const metricKeys = Object.keys(metrics);
  const firstMetricKey = metricKeys[0];
  const firstMetric = metrics[firstMetricKey] ?? {};
  const observedCounts: number[] = [];
  const observedMap: Record<string, number> = {};

  const ctrlData = firstMetric[control] as Record<string, number> | undefined;
  if (ctrlData) {
    const n = Math.floor(ctrlData.n ?? 0);
    observedCounts.push(n);
    observedMap[control] = n;
  }
  for (const trt of treatments) {
    const trtData = firstMetric[trt] as Record<string, number> | undefined;
    if (trtData) {
      const n = Math.floor(trtData.n ?? 0);
      observedCounts.push(n);
      observedMap[trt] = n;
    }
  }

  const srmPValue = srmCheck(observedCounts);
  const srm: SrmResult = {
    chi2_p_value: round(srmPValue, 4),
    ok: srmPValue >= 0.01,
    observed: observedMap,
  };

  // Sample-size check
  const sampleVariants: Record<string, number> = {};
  for (const [variant, n] of Object.entries(observedMap)) {
    sampleVariants[variant] = n;
  }
  const minN = Math.min(...Object.values(sampleVariants));
  const sampleCheck: SampleCheck = {
    minimum_per_variant: minimumSample,
    ok: minimumSample === 0 || minN >= minimumSample,
    variants: sampleVariants,
  };

  // Primary metric (first non-guardrail metric)
  const guardrailSet = new Set(guardrailDefs.map((g) => g.event));
  const primaryKey = metricKeys.find((k) => !guardrailSet.has(k)) ?? metricKeys[0];
  const primaryData = metrics[primaryKey];

  const primaryMetric = primaryData
    ? computeMetricSection(primaryKey, primaryData, control, treatments, false, prior, primaryMetricAgg)
    : null;

  // Detect variant key mismatch and build warnings
  const warnings: string[] = [];
  if (!primaryMetric && primaryData) {
    const availableKeys = Object.keys(primaryData);
    const missing = [control, ...treatments].filter((v) => !availableKeys.includes(v));
    if (missing.length > 0) {
      warnings.push(
        `Variant key mismatch: expected [${[control, ...treatments].join(", ")}] but metric data has [${availableKeys.join(", ")}]. ` +
        `Update the run's control/treatment variant settings to match the actual variation values.`
      );
    }
  }

  // Guardrails. Live track-service responses don't carry the user's `inverse`
  // declaration, so attach it here from the guardrail definition before
  // computeMetricSection reads `mdata.inverse`. Same for metricAgg.
  const guardrailSections: MetricSection[] = [];
  for (const def of guardrailDefs) {
    const gData = metrics[def.event] as Record<string, unknown> | undefined;
    if (!gData) continue;
    if (def.inverse && gData.inverse === undefined) {
      gData.inverse = true;
    }
    const section = computeMetricSection(
      def.event,
      gData,
      control,
      treatments,
      true,
      undefined,
      def.metricAgg,
    );
    if (section) guardrailSections.push(section);
  }

  return {
    type: "bayesian",
    experiment: slug,
    computed_at: new Date().toISOString(),
    window: {
      start: observationStart ?? undefined,
      end: observationEnd ?? undefined,
    },
    control,
    treatments,
    prior: priorLabel,
    srm,
    primary_metric: primaryMetric,
    guardrails: guardrailSections,
    sample_check: sampleCheck,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
