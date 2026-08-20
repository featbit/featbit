export const STAGES = [
  {
    key: "hypothesis",
    label: "Intent & Hypothesis",
    cf: "CF-01/02",
    skill: "intent-shaping / hypothesis-design",
    description: "Define the goal, form a falsifiable hypothesis",
    color:
      "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  {
    key: "implementing",
    label: "Exposure",
    cf: "CF-03/04",
    skill: "reversible-exposure-control",
    description: "Feature flag, rollout strategy & traffic exposure",
    color:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  {
    key: "measuring",
    label: "Measuring",
    cf: "CF-05/06/07",
    skill: "measurement-design / experiment-workspace / evidence-analysis",
    description: "Run experiments, track metrics & make decisions",
    color:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  },
  {
    key: "learning",
    label: "Learning",
    cf: "CF-08",
    skill: "learning-capture",
    description: "Capture learnings for next cycle",
    color:
      "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export function getStage(key: string) {
  return STAGES.find((s) => s.key === key) ?? STAGES[0];
}
