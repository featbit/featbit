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
  skipReasonTemplate: string;
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
      "Current UI step: Frame the decision.",
      "Apply CF-01 and CF-02. If goal or hypothesis is already sufficient, explain why and skip to the next applicable skill.",
      "Otherwise run intent-shaping and hypothesis-design.",
      "",
      "Completion criteria: {completionCriteria}",
      "Persist updates with featbit_release_decision_update_experiment and advance stage through MCP.",
      "Do not ask the user to manually enter variants or observed data.",
    ].join("\n"),
    skipReasonTemplate:
      "Goal and hypothesis are already present in MCP state. The agent should verify falsifiability and skip shaping work that is already satisfied.",
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
      "Current UI step: Control exposure.",
      "Apply CF-03 and CF-04. If the FeatBit flag is already bound and variation mapping comes from the actual flag, explain why and skip flag setup.",
      "Otherwise run reversible-exposure-control.",
      "",
      "Completion criteria: {completionCriteria}",
      "Persist updates with featbit_release_decision_update_experiment, update run exposure fields through MCP, and advance stage through MCP.",
      "Do not ask the user to manually enter variants or observed data.",
    ].join("\n"),
    skipReasonTemplate:
      "The experiment already has a FeatBit flag and stored variations from the flag configuration. The agent should verify rollout and rollback conditions before moving on.",
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
      "There is exactly one primary success metric.",
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
      "Current UI step: Measure and run.",
      "Apply CF-05 and CF-06. If primary metric, guardrails, event instrumentation, and run setup are already sufficient, explain why and skip to evidence sufficiency.",
      "Otherwise run measurement-design and experiment-workspace.",
      "",
      "Completion criteria: {completionCriteria}",
      "Use FeatBit managed flag evaluation data and FeatBit metric event data. Third-party API evidence is only planned and must not be used for actual analysis yet.",
      "Persist metric and run updates through MCP. Do not ask the user to manually enter variants or observed data.",
    ].join("\n"),
    skipReasonTemplate:
      "Metric and run state already exist. The agent should check evidence sufficiency before recommending a decision.",
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
      "Current UI step: Decide and learn.",
      "Apply CF-06, CF-07, and CF-08. If evidence is insufficient, stop at evidence sufficiency and do not fabricate a decision.",
      "If a decision already exists, run learning-capture; otherwise run evidence-analysis first.",
      "",
      "Completion criteria: {completionCriteria}",
      "Persist analysis, decision fields, and learning with FeatBit MCP tools.",
      "Do not ask the user to manually enter variants or observed data.",
    ].join("\n"),
    skipReasonTemplate:
      "A decision exists before learning capture. The agent should capture durable learning and seed the next intent.",
  },
];

export function getGuidedExperimentStep(stageKey: string) {
  return (
    GUIDED_EXPERIMENT_STEPS.find((step) => step.stageKey === stageKey) ??
    GUIDED_EXPERIMENT_STEPS[0]
  );
}
