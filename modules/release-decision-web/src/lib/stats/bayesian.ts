/**
 * Bayesian A/B test analysis functions.
 *
 * TypeScript port of agent/data/Scripts/stats_utils.py.
 * Pure analytical Gaussian-posterior — no sampling, no external dependencies.
 */

import {
  chi2SF,
  normalCDF,
  normalPPF,
  normalSF,
  truncatedNormalMean,
} from "./distributions";
import type { BayesianResult, GaussianPrior } from "./types";

const ALPHA = 0.05; // credible interval = 1 − ALPHA

// ═══════════════════════════════════════════════════════════════════════════
// METRIC MOMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract (mean, variance, n) from a variant data dict.
 *
 * Handles three shapes:
 *   Proportion:  { n, k }                         → Bernoulli variance p(1−p)
 *   Continuous:  { n, sum, sum_squares }           → sample variance
 *   Continuous:  { n, mean, variance }             → pre-computed (from TSDB)
 */
export function metricMoments(
  vdata: Record<string, number>,
): [mean: number, variance: number, n: number] {
  const n = Math.floor(vdata.n ?? 0);
  if (n === 0) return [0, 0, 0];

  if ("k" in vdata) {
    const mean = vdata.k / n;
    const variance = mean * (1 - mean);
    return [mean, variance, n];
  }

  if ("sum" in vdata) {
    const s = vdata.sum;
    const ss = vdata.sum_squares ?? 0;
    const mean = s / n;
    const variance = n > 1 ? (ss - (s * s) / n) / (n - 1) : 0;
    return [mean, variance, n];
  }

  if ("mean" in vdata) {
    return [vdata.mean, vdata.variance ?? 0, n];
  }

  return [0, 0, 0];
}

// ═══════════════════════════════════════════════════════════════════════════
// DELTA-METHOD STANDARD ERROR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SE for absolute or relative effect via the delta method.
 *
 * Absolute: SE( mean_b − mean_a )
 * Relative: SE( (mean_b − mean_a) / mean_a )
 */
function deltaMethodSE(
  meanA: number, varA: number, nA: number,
  meanB: number, varB: number, nB: number,
  relative: boolean,
): number {
  if (relative) {
    if (meanA === 0) return 0;
    return Math.sqrt(
      varB / (nB * meanA ** 2) +
      (varA * meanB ** 2) / (nA * meanA ** 4),
    );
  }
  return Math.sqrt(varB / nB + varA / nA);
}

// ═══════════════════════════════════════════════════════════════════════════
// RISK (EXPECTED OPPORTUNITY COST)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * (risk_ctrl, risk_trt) where δ ~ N(mu, sigma²) is the relative treatment effect.
 *
 * risk_ctrl = E[max(0, δ)]  — opportunity cost of keeping control
 * risk_trt  = E[max(0, −δ)] — downside risk of adopting treatment
 */
function risk(
  mu: number,
  sigma: number,
): [riskCtrl: number, riskTrt: number] {
  const pCtrlBetter = normalCDF(0, mu, sigma);
  const mnNeg = truncatedNormalMean(mu, sigma, -Infinity, 0);
  const mnPos = truncatedNormalMean(mu, sigma, 0, Infinity);
  return [
    (1 - pCtrlBetter) * mnPos,
    -pCtrlBetter * mnNeg,
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// BAYESIAN A/B TEST
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analytical Gaussian-posterior Bayesian A/B test.
 *
 * Port of stats_utils.bayesian_result().
 */
export function bayesianResult(
  meanA: number, varA: number, nA: number,
  meanB: number, varB: number, nB: number,
  inverse = false,
  prior?: GaussianPrior | null,
): BayesianResult {
  if (nA === 0 || nB === 0) {
    return { error: "zero sample size" } as BayesianResult;
  }
  if (meanA === 0) {
    return { error: "control mean is zero — cannot compute relative effect" } as BayesianResult;
  }

  let seRel = deltaMethodSE(meanA, varA, nA, meanB, varB, nB, true);
  if (seRel === 0) {
    return { error: "zero standard error (no variance in data)" } as BayesianResult;
  }

  let muRel = (meanB - meanA) / meanA;
  const muAbs = meanB - meanA;

  let priorApplied = false;
  if (prior && prior.proper) {
    const dataPrec = 1 / (seRel ** 2);
    const priorPrec = 1 / prior.variance;
    const postPrec = dataPrec + priorPrec;
    muRel = (muRel * dataPrec + prior.mean * priorPrec) / postPrec;
    seRel = Math.sqrt(1 / postPrec);
    priorApplied = true;
  }

  const zHalf = normalPPF(1 - ALPHA / 2);

  let ctw = normalSF(0, muRel, seRel);
  if (inverse) ctw = 1 - ctw;

  let [riskC, riskT] = risk(muRel, seRel);
  if (inverse) [riskC, riskT] = [riskT, riskC];

  return {
    error: null,
    chance_to_win: ctw,
    relative_change: muRel,
    absolute_change: muAbs,
    ci_rel_lower: muRel - zHalf * seRel,
    ci_rel_upper: muRel + zHalf * seRel,
    risk_ctrl: riskC,
    risk_trt: riskT,
    prior_applied: priorApplied,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SRM CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Chi-squared Sample Ratio Mismatch test. Returns p-value.
 * p < 0.01 is the common alarm threshold.
 */
export function srmCheck(
  observed: number[],
  expectedWeights?: number[] | null,
): number {
  const total = observed.reduce((a, b) => a + b, 0);
  if (total === 0) return 1.0;

  const k = observed.length;
  const weights = expectedWeights ?? Array(k).fill(1 / k);
  const totalW = weights.reduce((a, b) => a + b, 0);

  let chiSq = 0;
  for (let i = 0; i < k; i++) {
    if (weights[i] <= 0) continue;
    const expected = (weights[i] / totalW) * total;
    chiSq += (observed[i] - expected) ** 2 / expected;
  }

  return chi2SF(chiSq, k - 1);
}
