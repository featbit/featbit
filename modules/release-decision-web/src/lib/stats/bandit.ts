/**
 * Thompson Sampling bandit analysis.
 *
 * TypeScript port of analyze-bandit.py with deterministic seeded RNG.
 */

import { metricMoments, srmCheck } from "./bayesian";
import type { GaussianPrior } from "./types";

const MIN_UNITS_PER_ARM = 100;
const MIN_ARM_WEIGHT = 0.01;
const N_SAMPLES = 10_000;

export interface BanditArmStat {
  arm: string;
  mean: number;
  variance: number;
  n: number;
  conversions?: number;
  rate?: number;
}

export interface BanditWeightResult {
  enough_units: boolean;
  update_message: string;
  best_arm_probabilities: Record<string, number> | null;
  bandit_weights: Record<string, number> | null;
  seed: number | null;
}

export interface DeterministicBanditResult {
  best_arm_probabilities: Record<string, number>;
  bandit_weights: Record<string, number>;
}

export interface BanditAnalysisOutput {
  type: "bandit";
  experiment: string;
  computed_at: string;
  window: { start?: string; end?: string };
  metric: string;
  algorithm: string;
  srm: {
    chi2_p_value: number;
    ok: boolean;
    observed: Record<string, number>;
  };
  arms: Array<{ arm: string; n: number; conversions: number; rate: number }>;
  thompson_sampling: {
    results: Array<{ arm: string; p_best: number; recommended_weight: number }>;
    enough_units: boolean;
    update_message: string;
    seed: number | null;
  };
  stopping: {
    met: boolean;
    best_arm: string;
    p_best: number;
    threshold: number;
    message: string;
  };
}

function armPosterior(
  mean: number,
  variance: number,
  n: number,
  prior: GaussianPrior,
): [postMean: number, postVariance: number] {
  if (n === 0 || variance === 0) {
    return [prior.mean, prior.variance];
  }

  const dataVar = variance / n;
  if (!prior.proper) {
    return [mean, dataVar];
  }

  const dataPrec = 1 / dataVar;
  const priorPrec = 1 / prior.variance;
  const postPrec = dataPrec + priorPrec;
  const postMean = (mean * dataPrec + prior.mean * priorPrec) / postPrec;
  const postVar = 1 / postPrec;
  return [postMean, postVar];
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function normal01(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function computeBanditWeights(
  armNames: string[],
  armStats: Array<{ mean: number; variance: number; n: number }>,
  prior: GaussianPrior,
  inverse = false,
  topTwo = true,
  seed?: number,
): BanditWeightResult {
  const counts = armStats.map((s) => s.n);
  if (counts.some((n) => n < MIN_UNITS_PER_ARM)) {
    const minN = Math.min(...counts);
    return {
      enough_units: false,
      update_message: `burn-in: need >= ${MIN_UNITS_PER_ARM} users per arm before dynamic weighting (current minimum: ${minN})`,
      best_arm_probabilities: null,
      bandit_weights: null,
      seed: null,
    };
  }

  const post = armStats.map((s) => armPosterior(s.mean, s.variance, s.n, prior));
  const postMeans = post.map(([m]) => m);
  const postStd = post.map(([, v]) => Math.sqrt(Math.max(v, 1e-12)));

  const usedSeed = seed ?? Math.floor(Math.random() * 1_000_000);
  const rng = mulberry32(usedSeed);

  const nArms = armNames.length;
  const bestCounts = new Array<number>(nArms).fill(0);
  const topTwoCounts = new Array<number>(nArms).fill(0);

  for (let i = 0; i < N_SAMPLES; i++) {
    const draw = new Array<number>(nArms);
    for (let j = 0; j < nArms; j++) {
      draw[j] = postMeans[j] + postStd[j] * normal01(rng);
    }

    const order = draw
      .map((v, idx) => ({ v, idx }))
      .sort((a, b) => (inverse ? a.v - b.v : b.v - a.v));

    const top1 = order[0].idx;
    bestCounts[top1] += 1;

    if (topTwo && nArms > 1) {
      topTwoCounts[order[0].idx] += 1;
      topTwoCounts[order[1].idx] += 1;
    }
  }

  const bestArmProbs: Record<string, number> = {};
  for (let i = 0; i < nArms; i++) {
    bestArmProbs[armNames[i]] = bestCounts[i] / N_SAMPLES;
  }

  let weights = new Array<number>(nArms).fill(0);
  if (topTwo && nArms > 1) {
    const denom = topTwoCounts.reduce((a, b) => a + b, 0);
    if (denom > 0) {
      weights = topTwoCounts.map((c) => c / denom);
    } else {
      weights = new Array<number>(nArms).fill(1 / nArms);
    }
  } else {
    weights = armNames.map((a) => bestArmProbs[a]);
  }

  weights = weights.map((w) => Math.max(w, MIN_ARM_WEIGHT));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  weights = weights.map((w) => w / sumWeights);

  const banditWeights: Record<string, number> = {};
  for (let i = 0; i < nArms; i++) {
    banditWeights[armNames[i]] = weights[i];
  }

  return {
    enough_units: true,
    update_message: "successfully updated",
    best_arm_probabilities: bestArmProbs,
    bandit_weights: banditWeights,
    seed: usedSeed,
  };
}

/**
 * Deterministic evaluator used for cross-language parity tests.
 * It computes P(best) and Top-Two weights from a fixed sample matrix.
 */
export function computeBanditFromSamples(
  armNames: string[],
  samples: number[][],
  inverse = false,
  topTwo = true,
): DeterministicBanditResult {
  const nArms = armNames.length;
  const nSamples = samples.length;

  if (nArms === 0 || nSamples === 0) {
    return {
      best_arm_probabilities: {},
      bandit_weights: {},
    };
  }

  const bestCounts = new Array<number>(nArms).fill(0);
  const topTwoCounts = new Array<number>(nArms).fill(0);

  for (const row of samples) {
    const order = row
      .map((v, idx) => ({ v, idx }))
      .sort((a, b) => (inverse ? a.v - b.v : b.v - a.v));

    bestCounts[order[0].idx] += 1;

    if (topTwo && nArms > 1) {
      topTwoCounts[order[0].idx] += 1;
      topTwoCounts[order[1].idx] += 1;
    }
  }

  const bestArmProbabilities: Record<string, number> = {};
  for (let i = 0; i < nArms; i++) {
    bestArmProbabilities[armNames[i]] = bestCounts[i] / nSamples;
  }

  let weights = new Array<number>(nArms).fill(0);
  if (topTwo && nArms > 1) {
    const denom = topTwoCounts.reduce((a, b) => a + b, 0);
    weights = denom > 0
      ? topTwoCounts.map((c) => c / denom)
      : new Array<number>(nArms).fill(1 / nArms);
  } else {
    weights = armNames.map((a) => bestArmProbabilities[a]);
  }

  weights = weights.map((w) => Math.max(w, MIN_ARM_WEIGHT));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  weights = weights.map((w) => w / sumWeights);

  const banditWeights: Record<string, number> = {};
  for (let i = 0; i < nArms; i++) {
    banditWeights[armNames[i]] = weights[i];
  }

  return {
    best_arm_probabilities: bestArmProbabilities,
    bandit_weights: banditWeights,
  };
}

export interface RunBanditInput {
  slug: string;
  metricEvent: string;
  metrics: Record<string, Record<string, unknown>>;
  control: string;
  treatments: string[];
  observationStart?: string;
  observationEnd?: string;
  priorProper?: boolean;
  priorMean?: number;
  priorStddev?: number;
}

export function runBanditAnalysis(input: RunBanditInput): BanditAnalysisOutput {
  const prior: GaussianPrior = {
    proper: input.priorProper ?? false,
    mean: input.priorMean ?? 0,
    variance: (input.priorStddev ?? 0.3) ** 2,
  };

  const allArms = [input.control, ...input.treatments];
  const metricData = input.metrics[input.metricEvent] as Record<string, Record<string, number>>;

  const stats: BanditArmStat[] = allArms.map((arm) => {
    const vdata = metricData[arm] ?? {};
    const [mean, variance, n] = metricMoments(vdata);
    const conversions = "k" in vdata ? (vdata.k ?? 0) : 0;
    const rate = "k" in vdata ? (n > 0 ? (vdata.k ?? 0) / n : 0) : mean;
    return { arm, mean, variance, n, conversions, rate };
  });

  const observed = stats.map((s) => s.n);
  const srmP = srmCheck(observed);
  const inverse = Boolean((metricData as Record<string, unknown>).inverse);

  const result = computeBanditWeights(
    allArms,
    stats.map((s) => ({ mean: s.mean, variance: s.variance, n: s.n })),
    prior,
    inverse,
    true,
  );

  const bestProbs = result.best_arm_probabilities ?? {};
  const weights = result.bandit_weights ?? {};
  const bestArm = allArms.reduce((acc, arm) => (bestProbs[arm] ?? 0) > (bestProbs[acc] ?? 0) ? arm : acc, allArms[0]);
  const bestP = bestProbs[bestArm] ?? 0;
  const threshold = 0.95;
  const stopMet = result.enough_units && bestP >= threshold;

  return {
    type: "bandit",
    experiment: input.slug,
    computed_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    window: { start: input.observationStart, end: input.observationEnd },
    metric: input.metricEvent,
    algorithm: "thompson_sampling_top_two",
    srm: {
      chi2_p_value: Number(srmP.toFixed(4)),
      ok: srmP >= 0.01,
      observed: Object.fromEntries(allArms.map((arm, idx) => [arm, observed[idx]])),
    },
    arms: stats.map((s) => ({
      arm: s.arm,
      n: s.n,
      conversions: s.conversions ?? 0,
      rate: s.rate ?? 0,
    })),
    thompson_sampling: {
      results: allArms.map((arm) => ({
        arm,
        p_best: bestProbs[arm] ?? 0,
        recommended_weight: weights[arm] ?? 0,
      })),
      enough_units: result.enough_units,
      update_message: result.update_message,
      seed: result.seed,
    },
    stopping: {
      met: stopMet,
      best_arm: bestArm,
      p_best: bestP,
      threshold,
      message: stopMet
        ? `${bestArm} reached P(best)=${bestP.toFixed(4)} >= ${threshold.toFixed(2)}`
        : result.enough_units
        ? `best arm ${bestArm} currently at P(best)=${bestP.toFixed(4)}, threshold=${threshold.toFixed(2)}`
        : result.update_message,
    },
  };
}
