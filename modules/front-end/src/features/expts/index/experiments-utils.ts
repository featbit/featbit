import type { Lang } from "@/features/layout/layout-types"
import type { ExperimentStage } from "./experiment-types"

export function formatExperimentDate(value: string, lang: Lang) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(date)
}

export function experimentMethodKeys(summary: string | null) {
  if (!summary) return []
  const normalized = summary.toLowerCase()
  const keys: Array<"bayesian" | "bandit"> = []
  if (normalized.includes("bayesian")) keys.push("bayesian")
  if (normalized.includes("bandit")) keys.push("bandit")
  return keys
}

export function experimentStageDot(stage: ExperimentStage) {
  switch (stage) {
    case "implementing":
      return "bg-emerald-600"
    case "measuring":
      return "bg-blue-500"
    case "learning":
      return "bg-amber-500"
    default:
      return "bg-zinc-400"
  }
}
