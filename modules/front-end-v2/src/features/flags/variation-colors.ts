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

export function variationMarkerColor(index: number) {
  return VARIATION_MARKER_COLORS[index % VARIATION_MARKER_COLORS.length]
}
