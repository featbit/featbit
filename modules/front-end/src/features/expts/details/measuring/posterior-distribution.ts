import type { AnalysisRow } from "./measuring-types"

export function posteriorDistribution(row: AnalysisRow) {
  const { relDelta: mean, ciLower: lower, ciUpper: upper } = row
  if (
    mean === undefined ||
    lower === undefined ||
    upper === undefined ||
    !Number.isFinite(mean) ||
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    upper <= lower
  ) {
    return null
  }

  // Match the previous UI's normal approximation from the reported 95% interval.
  const sigma = (upper - lower) / (2 * 1.96)
  const min = Math.min(mean - 3.5 * sigma, lower)
  const max = Math.max(mean + 3.5 * sigma, upper)
  if (
    !Number.isFinite(sigma) ||
    sigma <= 0 ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max <= min
  ) {
    return null
  }

  const effects = new Set([
    lower,
    mean,
    upper,
    ...Array.from(
      { length: 81 },
      (_, index) => min + (max - min) * (index / 80)
    ),
  ])
  const points = [...effects]
    .sort((a, b) => a - b)
    .map((effect) => {
      // Normalize the peak to 1; the vertical axis has no density labels.
      const density = Math.exp(-0.5 * ((effect - mean) / sigma) ** 2)
      return {
        effect,
        density,
        interval: effect >= lower && effect <= upper ? density : null,
      }
    })

  return { mean, lower, upper, min, max, points }
}
