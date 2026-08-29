import type { LayerRunSummary } from "./layers-types"

export function slugifyLayerKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function runColor(index: number) {
  return [
    "bg-blue-200 dark:bg-blue-800",
    "bg-blue-400 dark:bg-blue-600",
    "bg-violet-400 dark:bg-violet-600",
    "bg-indigo-300 dark:bg-indigo-700",
  ][index % 4]
}

export function runStateColor(status: LayerRunSummary["status"]) {
  switch (status.toLowerCase()) {
    case "collecting":
      return "bg-emerald-600"
    case "analyzing":
      return "bg-amber-500"
    default:
      return "bg-zinc-400"
  }
}
