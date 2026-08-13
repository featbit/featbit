export const VARIATION_MARKER_COLORS = [
  "bg-blue-600 dark:bg-blue-400",
  "bg-emerald-600 dark:bg-emerald-400",
  "bg-amber-500 dark:bg-amber-400",
  "bg-violet-600 dark:bg-violet-400",
  "bg-rose-600 dark:bg-rose-400",
  "bg-cyan-600 dark:bg-cyan-400",
  "bg-orange-600 dark:bg-orange-400",
  "bg-indigo-600 dark:bg-indigo-400",
  "bg-lime-600 dark:bg-lime-400",
  "bg-fuchsia-600 dark:bg-fuchsia-400",
] as const

export const VARIATION_CHART_COLORS = [
  "var(--variation-color-1)",
  "var(--variation-color-2)",
  "var(--variation-color-3)",
  "var(--variation-color-4)",
  "var(--variation-color-5)",
  "var(--variation-color-6)",
  "var(--variation-color-7)",
  "var(--variation-color-8)",
  "var(--variation-color-9)",
  "var(--variation-color-10)",
] as const

export const VARIATION_CHART_COLOR_VARS =
  "[--variation-color-1:var(--color-blue-600)] [--variation-color-2:var(--color-emerald-600)] [--variation-color-3:var(--color-amber-500)] [--variation-color-4:var(--color-violet-600)] [--variation-color-5:var(--color-rose-600)] [--variation-color-6:var(--color-cyan-600)] [--variation-color-7:var(--color-orange-600)] [--variation-color-8:var(--color-indigo-600)] [--variation-color-9:var(--color-lime-600)] [--variation-color-10:var(--color-fuchsia-600)] dark:[--variation-color-1:var(--color-blue-400)] dark:[--variation-color-2:var(--color-emerald-400)] dark:[--variation-color-3:var(--color-amber-400)] dark:[--variation-color-4:var(--color-violet-400)] dark:[--variation-color-5:var(--color-rose-400)] dark:[--variation-color-6:var(--color-cyan-400)] dark:[--variation-color-7:var(--color-orange-400)] dark:[--variation-color-8:var(--color-indigo-400)] dark:[--variation-color-9:var(--color-lime-400)] dark:[--variation-color-10:var(--color-fuchsia-400)]"

export function variationMarkerColor(index: number) {
  return VARIATION_MARKER_COLORS[index % VARIATION_MARKER_COLORS.length]
}

export function variationChartColor(index: number) {
  return VARIATION_CHART_COLORS[index % VARIATION_CHART_COLORS.length]
}
