export function normalizeMetricKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function metricRunStateColor(status: string) {
  switch (status.toLowerCase()) {
    case "running":
    case "collecting":
      return "bg-emerald-600"
    case "completed":
    case "analyzing":
      return "bg-blue-600"
    default:
      return "bg-zinc-400"
  }
}
