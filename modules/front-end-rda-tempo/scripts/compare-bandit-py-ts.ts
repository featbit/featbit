import { spawnSync } from "node:child_process";
import path from "node:path";
import { computeBanditFromSamples, computeBanditWeights } from "../src/lib/stats/bandit";
import type { GaussianPrior } from "../src/lib/stats/types";

type CaseDef = {
  name: string;
  armNames: string[];
  armStats: Array<[mean: number, variance: number, n: number]>;
  prior: GaussianPrior;
  inverse?: boolean;
  seed: number;
};

type PythonResult = {
  enough_units: boolean;
  update_message: string;
  best_arm_probabilities: Record<string, number> | null;
  bandit_weights: Record<string, number> | null;
  seed: number | null;
};

type DeterministicCase = {
  name: string;
  armNames: string[];
  samples: number[][];
  inverse?: boolean;
};

const PY_CODE = String.raw`
import importlib.util
import json
import pathlib
import sys

payload = json.loads(sys.stdin.read())
script_path = pathlib.Path(payload["script_path"]).resolve()
sys.path.insert(0, str(script_path.parent))

spec = importlib.util.spec_from_file_location("analyze_bandit_mod", str(script_path))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

prior_payload = payload["prior"]
prior = mod.GaussianPrior(
    mean=float(prior_payload["mean"]),
    variance=float(prior_payload["variance"]),
    proper=bool(prior_payload["proper"]),
)

arm_stats = [(float(x[0]), float(x[1]), int(x[2])) for x in payload["arm_stats"]]
res = mod.compute_bandit_weights(
    arm_names=payload["arm_names"],
    arm_stats=arm_stats,
    prior=prior,
    inverse=bool(payload.get("inverse", False)),
    top_two=True,
    seed=int(payload["seed"]),
)

print(json.dumps(res))
`;

const PY_DETERMINISTIC_CODE = String.raw`
import json
import numpy as np
import sys

payload = json.loads(sys.stdin.read())
arm_names = payload["arm_names"]
samples = np.array(payload["samples"], dtype=float)
inverse = bool(payload.get("inverse", False))
min_arm_weight = float(payload.get("min_arm_weight", 0.01))

if inverse:
  best_mask = samples == samples.min(axis=1, keepdims=True)
  sorted_idx = np.argsort(samples, axis=1)
  top1 = sorted_idx[:, 0]
  top2 = sorted_idx[:, 1]
else:
  best_mask = samples == samples.max(axis=1, keepdims=True)
  sorted_idx = np.argsort(samples, axis=1)
  top1 = sorted_idx[:, -1]
  top2 = sorted_idx[:, -2]

best_probs = best_mask.mean(axis=0)

counts = np.zeros(samples.shape[1])
for i in range(samples.shape[1]):
  counts[i] = np.sum(top1 == i) + np.sum(top2 == i)

weights = counts / counts.sum() if counts.sum() > 0 else np.full(samples.shape[1], 1.0 / samples.shape[1])
weights = np.maximum(weights, min_arm_weight)
weights = weights / weights.sum()

print(json.dumps({
  "best_arm_probabilities": dict(zip(arm_names, best_probs.tolist())),
  "bandit_weights": dict(zip(arm_names, weights.tolist()))
}))
`;

function runPython(caseDef: CaseDef, scriptPath: string): PythonResult {
  const proc = spawnSync(
    "python",
    ["-c", PY_CODE],
    {
      input: JSON.stringify({
        script_path: scriptPath,
        arm_names: caseDef.armNames,
        arm_stats: caseDef.armStats,
        prior: caseDef.prior,
        inverse: Boolean(caseDef.inverse),
        seed: caseDef.seed,
      }),
      encoding: "utf-8",
    },
  );

  if (proc.status !== 0) {
    throw new Error(`Python failed for ${caseDef.name}: ${proc.stderr || proc.stdout}`);
  }

  return JSON.parse(proc.stdout.trim()) as PythonResult;
}

function runPythonDeterministic(caseDef: DeterministicCase): {
  best_arm_probabilities: Record<string, number>;
  bandit_weights: Record<string, number>;
} {
  const proc = spawnSync(
    "python",
    ["-c", PY_DETERMINISTIC_CODE],
    {
      input: JSON.stringify({
        arm_names: caseDef.armNames,
        samples: caseDef.samples,
        inverse: Boolean(caseDef.inverse),
        min_arm_weight: 0.01,
      }),
      encoding: "utf-8",
    },
  );

  if (proc.status !== 0) {
    throw new Error(`Python deterministic failed for ${caseDef.name}: ${proc.stderr || proc.stdout}`);
  }

  return JSON.parse(proc.stdout.trim()) as {
    best_arm_probabilities: Record<string, number>;
    bandit_weights: Record<string, number>;
  };
}

function maxAbsDiff(
  a: Record<string, number> | null,
  b: Record<string, number> | null,
): number {
  if (!a || !b) return 0;
  let m = 0;
  for (const k of Object.keys(a)) {
    const d = Math.abs((a[k] ?? 0) - (b[k] ?? 0));
    if (d > m) m = d;
  }
  return m;
}

function main(): void {
  const scriptPath = path.resolve(__dirname, "../../data/Scripts/analyze-bandit.py");

  const cases: CaseDef[] = [
    {
      name: "binary-clear-winner-2arms",
      armNames: ["control", "treatment"],
      armStats: [
        [0.1200, 0.1200 * (1 - 0.1200), 1400],
        [0.1540, 0.1540 * (1 - 0.1540), 1400],
      ],
      prior: { mean: 0, variance: 0.3 ** 2, proper: false },
      seed: 42,
    },
    {
      name: "binary-close-race-3arms",
      armNames: ["control", "variant_a", "variant_b"],
      armStats: [
        [0.1010, 0.1010 * (1 - 0.1010), 2200],
        [0.1040, 0.1040 * (1 - 0.1040), 2200],
        [0.1065, 0.1065 * (1 - 0.1065), 2200],
      ],
      prior: { mean: 0, variance: 0.25 ** 2, proper: true },
      seed: 1337,
    },
    {
      name: "inverse-metric-3arms",
      armNames: ["control", "variant_a", "variant_b"],
      armStats: [
        [120.0, 18.0 ** 2, 900],
        [114.0, 17.5 ** 2, 900],
        [117.0, 17.0 ** 2, 900],
      ],
      prior: { mean: 0, variance: 0.3 ** 2, proper: false },
      inverse: true,
      seed: 7,
    },
    {
      name: "continuous-4arms",
      armNames: ["control", "v1", "v2", "v3"],
      armStats: [
        [32.0, 12.0 ** 2, 1200],
        [34.5, 12.5 ** 2, 1200],
        [31.2, 11.0 ** 2, 1200],
        [35.1, 13.0 ** 2, 1200],
      ],
      prior: { mean: 0, variance: 0.2 ** 2, proper: true },
      seed: 2026,
    },
    {
      name: "burn-in-not-enough-units",
      armNames: ["control", "treatment"],
      armStats: [
        [0.13, 0.13 * (1 - 0.13), 80],
        [0.16, 0.16 * (1 - 0.16), 95],
      ],
      prior: { mean: 0, variance: 0.3 ** 2, proper: false },
      seed: 99,
    },
  ];

  const report = cases.map((c) => {
    const py = runPython(c, scriptPath);
    const ts = computeBanditWeights(
      c.armNames,
      c.armStats.map(([mean, variance, n]) => ({ mean, variance, n })),
      c.prior,
      Boolean(c.inverse),
      true,
      c.seed,
    );

    return {
      case: c.name,
      py_enough_units: py.enough_units,
      ts_enough_units: ts.enough_units,
      py_message: py.update_message,
      ts_message: ts.update_message,
      max_abs_diff_p_best: maxAbsDiff(py.best_arm_probabilities, ts.best_arm_probabilities),
      max_abs_diff_weight: maxAbsDiff(py.bandit_weights, ts.bandit_weights),
      py_best_arm_probabilities: py.best_arm_probabilities,
      ts_best_arm_probabilities: ts.best_arm_probabilities,
      py_bandit_weights: py.bandit_weights,
      ts_bandit_weights: ts.bandit_weights,
    };
  });

  const deterministicCases: DeterministicCase[] = [
    {
      name: "det-2arms-clear",
      armNames: ["control", "treatment"],
      samples: [
        [0.10, 0.20],
        [0.12, 0.22],
        [0.08, 0.18],
        [0.15, 0.14],
        [0.11, 0.19],
        [0.09, 0.25],
        [0.13, 0.17],
        [0.07, 0.21],
      ],
    },
    {
      name: "det-3arms-mixed",
      armNames: ["a", "b", "c"],
      samples: [
        [1.0, 1.1, 0.8],
        [0.9, 1.3, 1.2],
        [1.2, 1.1, 1.0],
        [1.0, 1.4, 1.1],
        [0.95, 1.05, 1.25],
        [1.15, 1.2, 1.18],
        [0.88, 1.02, 1.3],
        [1.05, 1.0, 1.22],
      ],
    },
    {
      name: "det-3arms-inverse",
      armNames: ["slow", "mid", "fast"],
      inverse: true,
      samples: [
        [120, 110, 105],
        [118, 112, 107],
        [125, 108, 106],
        [119, 111, 104],
        [121, 109, 105],
        [123, 113, 108],
        [117, 110, 103],
        [122, 114, 109],
      ],
    },
  ];

  const deterministicReport = deterministicCases.map((c) => {
    const py = runPythonDeterministic(c);
    const ts = computeBanditFromSamples(
      c.armNames,
      c.samples,
      Boolean(c.inverse),
      true,
    );

    return {
      case: c.name,
      max_abs_diff_p_best: maxAbsDiff(py.best_arm_probabilities, ts.best_arm_probabilities),
      max_abs_diff_weight: maxAbsDiff(py.bandit_weights, ts.bandit_weights),
      py_best_arm_probabilities: py.best_arm_probabilities,
      ts_best_arm_probabilities: ts.best_arm_probabilities,
      py_bandit_weights: py.bandit_weights,
      ts_bandit_weights: ts.bandit_weights,
    };
  });

  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    n_cases_stochastic: report.length,
    n_cases_deterministic: deterministicReport.length,
    report,
    deterministic_report: deterministicReport,
  }, null, 2));
}

main();
