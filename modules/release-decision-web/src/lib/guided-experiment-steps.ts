export type GuidedExperimentStep = {
  key: "frame" | "exposure" | "measure" | "decide";
  stageKey: "hypothesis" | "implementing" | "measuring" | "learning";
  nextStageKey: "implementing" | "measuring" | "learning" | null;
  title: string;
  userGoal: string;
  skills: string[];
  cfTriggers: string[];
  completionCriteria: string[];
  mcpStateChecks: string[];
  agentPromptTemplate: string;
};

export const GUIDED_EXPERIMENT_STEPS: GuidedExperimentStep[] = [
  {
    key: "frame",
    stageKey: "hypothesis",
    nextStageKey: "implementing",
    title: "Frame the decision",
    userGoal:
      "Turn a rough product idea into a clear business goal, a concrete change, and a falsifiable hypothesis.",
    skills: ["intent-shaping", "hypothesis-design"],
    cfTriggers: ["CF-01", "CF-02"],
    completionCriteria: [
      "The business goal is clear enough to decide what success means.",
      "The intent separates the outcome from the proposed solution.",
      "The change is specific and reversible.",
      "The hypothesis names the audience, expected metric direction, and causal reason.",
      "Open questions or constraints are captured before exposure begins.",
    ],
    mcpStateChecks: ["goal", "intent", "hypothesis", "change", "constraints"],
    agentPromptTemplate: [
      "Use the featbit-release-decision skill as the entry point for experiment {experimentId}.",
      "Read the experiment through FeatBit MCP first.",
      "",
      "User-facing task: {userGoal}",
      "Apply CF-01 and CF-02 through intent-shaping and hypothesis-design.",
      "",
      "Act like a release-decision coach, not a batch job. If the experiment is blank or missing key decision fields, do not recap empty fields and do not persist placeholder text. Ask one short direct question to help the user clarify the experiment.",
      "For a blank experiment, start with exactly this question: What are you trying to improve or learn?",
      "As the user answers, extract the measurable business goal, original intent, specific reversible change, falsifiable hypothesis, audience, expected metric direction, causal reason, and open constraints. Ask only one question at a time.",
      "Suggest a concise draft when enough information exists, then confirm it before writing it back through MCP.",
      "Only call featbit_release_decision_update_experiment with concrete user-grounded fields. Only advance stage through MCP when all completion criteria are satisfied: {completionCriteria}",
      "Do not write primaryMetric, guardrails, metricEvent, metricType, or metricAgg in this step. Keep the expected metric direction inside the hypothesis text only.",
      "Do not ask the user for variants, rollout percentages, metric event keys, or observed data in this step.",
    ].join("\n"),
  },
  {
    key: "exposure",
    stageKey: "implementing",
    nextStageKey: "measuring",
    title: "Control exposure",
    userGoal:
      "Make the change reversible with a FeatBit managed flag, real flag variations, a rollout plan, and rollback conditions.",
    skills: ["reversible-exposure-control"],
    cfTriggers: ["CF-03", "CF-04"],
    completionCriteria: [
      "A FeatBit managed feature flag is bound to the experiment.",
      "Variation mapping comes from the actual FeatBit flag, not manual text.",
      "Audience, rollout percentage, or traffic pool is defined for the run.",
      "Rollback triggers and protected audiences are explicit.",
      "The change can be paused or reverted without redeploying.",
    ],
    mcpStateChecks: [
      "flagKey",
      "actual flag variations",
      "audienceFilters",
      "trafficPercent",
      "constraints",
    ],
    agentPromptTemplate: [
      "Use the featbit-release-decision skill as the entry point for experiment {experimentId}.",
      "Read the experiment through FeatBit MCP first.",
      "",
      "User-facing task: {userGoal}",
      "Apply CF-03 and CF-04 through reversible-exposure-control.",
      "",
      "Act like a release-decision coach. Help the user make the change reversible and decide who should see it first.",
      "Use separate FeatBit flag tools to inspect available flags and real flag variations only if those tools are actually available. The release-decision MCP persists experiment state but does not create feature flags.",
      "If direct flag tooling is unavailable, define the concrete flag contract, variants, rollout, and rollback rules, then tell the user what to create or bind in the FeatBit UI. If rollout or rollback logic is missing, ask one short question at a time.",
      "Persist only concrete flag, audience, rollout, and rollback decisions through MCP. Only advance stage when all completion criteria are satisfied: {completionCriteria}",
      "Do not ask the user for metric event keys or observed data in this step.",
    ].join("\n"),
  },
  {
    key: "measure",
    stageKey: "measuring",
    nextStageKey: "learning",
    title: "Measure and run",
    userGoal:
      "Define the metric contract, start or inspect a run, and use FeatBit evaluation plus metric event data as the evidence source.",
    skills: ["measurement-design", "experiment-workspace"],
    cfTriggers: ["CF-05", "CF-06"],
    completionCriteria: [
      "There is exactly one primary success metric with an expected better direction.",
      "Guardrails exist and have clear degradation direction.",
      "Required event instrumentation is named and mapped to FeatBit metric events.",
      "A run window, traffic mode, and minimum sample expectation are defined.",
      "Evidence comes from FeatBit flag evaluation data and FeatBit metric events.",
    ],
    mcpStateChecks: [
      "primaryMetric",
      "guardrails",
      "experiment run status",
      "observation window",
      "analysisResult",
    ],
    agentPromptTemplate: [
      "Use the featbit-release-decision skill as the entry point for experiment {experimentId}.",
      "Read the experiment through FeatBit MCP first.",
      "",
      "User-facing task: {userGoal}",
      "Apply CF-05 and CF-06 through measurement-design and experiment-workspace.",
      "",
      "Act like a release-decision coach. Help the user define one deciding metric, a small set of guardrails, the event instrumentation, and the run window.",
      "Ask one short question at a time when the metric contract is missing or ambiguous. Prefer event names that already exist in FeatBit when MCP can discover them.",
      "Use FeatBit managed flag evaluation data and FeatBit metric event data as the evidence source. Third-party API evidence is only planned and must not be used for actual analysis yet.",
      "When the primary metric name, event, type, aggregation, expected better direction, or guardrails are confirmed, write them with featbit_release_decision_update_metrics. metricName must be short, metricEvent must be a key with no spaces, metricType/metricAgg must use the supported enums, and expectedDirection is required with value increase_good or decrease_good. Do not store the technical metric contract only as free text in featbit_release_decision_update_experiment.",
      "Persist metric and run updates through MCP only when the user has provided or confirmed concrete values. Only advance stage when all completion criteria are satisfied: {completionCriteria}",
      "Do not ask the user to manually enter variants or observed data.",
    ].join("\n"),
  },
  {
    key: "decide",
    stageKey: "learning",
    nextStageKey: null,
    title: "Decide and learn",
    userGoal:
      "Frame the release decision, record the learning, and feed the next iteration with evidence instead of memory.",
    skills: ["evidence-analysis", "learning-capture"],
    cfTriggers: ["CF-06", "CF-07", "CF-08"],
    completionCriteria: [
      "Evidence is sufficient or explicitly marked insufficient.",
      "Decision is one of CONTINUE, PAUSE, ROLLBACK CANDIDATE, or INCONCLUSIVE.",
      "Decision rationale ties back to hypothesis and guardrails.",
      "Learning records what changed, what happened, why, and what to try next.",
      "If data is insufficient, the process pauses at evidence sufficiency instead of forcing a decision.",
    ],
    mcpStateChecks: [
      "analysisResult",
      "decision",
      "decisionSummary",
      "guardrail health",
      "lastLearning",
    ],
    agentPromptTemplate: [
      "Use the featbit-release-decision skill as the entry point for experiment {experimentId}.",
      "Read the experiment through FeatBit MCP first.",
      "",
      "User-facing task: {userGoal}",
      "Apply CF-06, CF-07, and CF-08 through evidence-analysis and learning-capture.",
      "",
      "Act like a release-decision coach. Help the user decide whether the evidence supports CONTINUE, PAUSE, ROLLBACK CANDIDATE, or INCONCLUSIVE.",
      "If evidence is missing or insufficient, explain the smallest next evidence action instead of forcing a decision.",
      "If a decision exists, guide the user to capture what changed, what happened, why, and what should be tried next.",
      "Persist analysis, decision fields, and learning through MCP only when grounded in available evidence or explicit user confirmation. Only treat the step as complete when all completion criteria are satisfied: {completionCriteria}",
      "Do not ask the user to manually enter variants or observed data.",
    ].join("\n"),
  },
];

export function getGuidedExperimentStep(stageKey: string) {
  return (
    GUIDED_EXPERIMENT_STEPS.find((step) => step.stageKey === stageKey) ??
    GUIDED_EXPERIMENT_STEPS[0]
  );
}
