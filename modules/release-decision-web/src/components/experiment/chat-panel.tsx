"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Loader2,
  MessageSquareText,
  Terminal,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateExperimentStage } from "@/lib/release-decision-client-data";
import {
  getGuidedExperimentStep,
  type GuidedExperimentStep,
} from "@/lib/guided-experiment-steps";
import { cn } from "@/lib/utils";
import type { Experiment, ExperimentRun } from "@/lib/release-decision-types";

export const CODING_AGENT_SETUP_DISMISSED_KEY =
  "featbit:coding-agent-setup:dismissed";

type CheckStatus = "satisfied" | "missing" | "warning";
type ExperimentWithRuns = Experiment & {
  experimentRuns: ExperimentRun[];
};

type StateCheck = {
  label: string;
  value: string;
  status: CheckStatus;
};

type StepReadiness = {
  canMarkSatisfied: boolean;
  summary: string;
  blocker: string | null;
};

export function ChatPanel({
  experiment,
  activeStage,
  suggestedPrompt,
  onStageChange,
  onOpenSetup,
}: {
  experiment: ExperimentWithRuns;
  activeStage: string;
  suggestedPrompt?: string | null;
  onStageChange?: (stageKey: string) => void;
  onOpenSetup?: () => void;
}) {
  const step = getGuidedExperimentStep(activeStage);
  const stateChecks = useMemo(
    () => buildStateChecks(step, experiment),
    [step, experiment],
  );
  const readiness = useMemo(
    () => buildStepReadiness(step, experiment),
    [step, experiment],
  );
  const prompt = useMemo(
    () =>
      buildAgentPrompt({
        step,
        experiment,
        stateChecks,
        suggestedPrompt,
      }),
    [experiment, stateChecks, step, suggestedPrompt],
  );
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  async function markStepSatisfied() {
    if (!step.nextStageKey || !readiness.canMarkSatisfied) {
      return;
    }

    setAdvancing(true);
    setAdvanceError(null);
    try {
      await updateExperimentStage(experiment.id, step.nextStageKey);
      onStageChange?.(step.nextStageKey);
    } catch (error) {
      setAdvanceError(
        error instanceof Error
          ? error.message
          : "Failed to advance the experiment stage.",
      );
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <aside className="flex h-full flex-col bg-card/55">
      <div className="border-b border-border/70 bg-background/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Workflow className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Experiment coach</h2>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          Use a coding agent, or edit the stage directly.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-lg border border-primary/25 bg-primary/[0.035] p-3 shadow-sm shadow-foreground/5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Terminal className="size-4 text-primary" />
              <h3>Agent prompt</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {step.cfTriggers.map((trigger) => (
                <span
                  key={trigger}
                  className="rounded border border-border/80 bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {trigger}
                </span>
              ))}
              <StepSatisfiedBadge ready={readiness.canMarkSatisfied} />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Copy this prompt into your coding agent to start this step.
          </p>
          {readiness.blocker && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              {readiness.blocker}
            </p>
          )}
          <div className="mt-3">
            <CodeBlock value={prompt} maxLines={14} />
          </div>
          {step.nextStageKey ? (
            <div className="mt-3">
              <Button
                size="sm"
                variant={readiness.canMarkSatisfied ? "default" : "outline"}
                onClick={markStepSatisfied}
                disabled={!readiness.canMarkSatisfied || advancing}
                className="h-8 gap-1.5"
              >
                {advancing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Satisfied
              </Button>
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-border/80 bg-muted/20 px-2 py-1.5">
              {readiness.summary}
            </p>
          )}
          {advanceError && (
            <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
              {advanceError}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={onOpenSetup}
          className="flex w-full items-center gap-2 rounded-lg border border-border/80 bg-background/72 px-3 py-2.5 text-left text-sm font-semibold shadow-sm shadow-foreground/5 transition-colors hover:border-primary/30 hover:bg-accent hover:text-accent-foreground"
        >
          <Terminal className="size-4 text-primary" />
          Optional coding-agent setup
        </button>
      </div>
    </aside>
  );
}

export function StageAgentGuide({
  experiment,
  activeStage,
  suggestedPrompt,
  onStageChange,
}: {
  experiment: ExperimentWithRuns;
  activeStage: string;
  suggestedPrompt?: string | null;
  onStageChange?: (stageKey: string) => void;
}) {
  const step = getGuidedExperimentStep(activeStage);
  const stateChecks = useMemo(
    () => buildStateChecks(step, experiment),
    [step, experiment],
  );
  const readiness = useMemo(
    () => buildStepReadiness(step, experiment),
    [step, experiment],
  );
  const prompt = useMemo(
    () =>
      buildAgentPrompt({
        step,
        experiment,
        stateChecks,
        suggestedPrompt,
      }),
    [experiment, stateChecks, step, suggestedPrompt],
  );
  const [promptOpen, setPromptOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const promptDialogRef = useRef<HTMLDivElement | null>(null);
  const ctaLabel = getAgentCtaLabel(step);

  useEffect(() => {
    if (!promptOpen) return;
    const id = window.requestAnimationFrame(() => {
      promptDialogRef.current?.scrollTo({ top: 0, left: 0 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [promptOpen]);

  async function markStepSatisfied() {
    if (!step.nextStageKey || !readiness.canMarkSatisfied) {
      return;
    }

    setAdvancing(true);
    setAdvanceError(null);
    try {
      await updateExperimentStage(experiment.id, step.nextStageKey);
      onStageChange?.(step.nextStageKey);
    } catch (error) {
      setAdvanceError(
        error instanceof Error
          ? error.message
          : "Failed to advance the experiment stage.",
      );
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <section className="rounded-md border border-primary/25 bg-primary/[0.035] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setPromptOpen(true)}
              className="h-8 gap-1.5"
            >
              <Terminal className="size-3.5" />
              {ctaLabel}
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Workflow className="size-3.5 text-primary" />
              {step.cfTriggers.join(" / ")}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Let a coding agent shape this step from current FeatBit state; you
            can still edit fields manually.
            {readiness.blocker ? (
              <span className="ml-1 text-amber-700 dark:text-amber-300">
                {readiness.blocker}
              </span>
            ) : null}
          </p>
          {advanceError && (
            <p className="mt-1 text-xs text-destructive">{advanceError}</p>
          )}
        </div>

        {step.nextStageKey && (
          <Button
            size="sm"
            variant={readiness.canMarkSatisfied ? "default" : "outline"}
            onClick={markStepSatisfied}
            disabled={!readiness.canMarkSatisfied || advancing}
            className={cn(
              "h-8 shrink-0 gap-1.5",
              readiness.canMarkSatisfied &&
                "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            {advancing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Satisfied
          </Button>
        )}
      </div>

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent
          ref={promptDialogRef}
          className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Terminal className="size-4 text-primary" />
              {ctaLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {step.userGoal}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <GuideSection
              icon={<MessageSquareText className="size-4" />}
              title="Agent task"
            >
              <p>{step.userGoal}</p>
            </GuideSection>

            <GuideSection
              icon={<Database className="size-4" />}
              title="Still needed for Satisfied"
            >
              <MissingForSatisfied
                readiness={readiness}
                stateChecks={stateChecks}
              />
            </GuideSection>

            <GuideSection
              icon={<Terminal className="size-4" />}
              title="How to use it"
            >
              <p>
                Copy this prompt into your coding agent. Use <code>Setup</code>{" "}
                first if the agent is not connected yet.
              </p>
              <div className="mt-3">
                <CodeBlock value={prompt} maxLines={12} />
              </div>
            </GuideSection>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function getAgentCtaLabel(step: GuidedExperimentStep) {
  switch (step.key) {
    case "frame":
      return "Define Intent & Hypothesis Via Coding Agent";
    case "exposure":
      return "Configure Exposure Via Coding Agent";
    case "measure":
      return "Set Up Measuring Via Coding Agent";
    case "decide":
      return "Capture Learning Via Coding Agent";
  }
}

function MissingForSatisfied({
  readiness,
  stateChecks,
}: {
  readiness: StepReadiness;
  stateChecks: StateCheck[];
}) {
  if (readiness.canMarkSatisfied) {
    return <p>This step is ready to mark as satisfied.</p>;
  }

  const missing = stateChecks.filter((check) => check.status === "missing");
  const warnings = stateChecks.filter((check) => check.status === "warning");
  const visibleItems = missing.length > 0 ? missing : warnings;

  if (visibleItems.length === 0) {
    return <p>{readiness.summary}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {visibleItems.map((check) => (
        <li key={check.label} className="flex gap-2">
          <AlertCircle
            className={cn(
              "mt-0.5 size-3.5 shrink-0",
              check.status === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : "text-destructive",
            )}
          />
          <span>
            <span className="font-medium text-foreground">{check.label}</span>
            {": "}
            {check.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StepSatisfiedBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        ready
          ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300",
      )}
    >
      {ready ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <AlertCircle className="size-3" />
      )}
      {ready ? "Satisfied" : "Needs input"}
    </span>
  );
}

function buildAgentPrompt({
  step,
  experiment,
  stateChecks,
  suggestedPrompt,
}: {
  step: GuidedExperimentStep;
  experiment: ExperimentWithRuns;
  stateChecks: StateCheck[];
  suggestedPrompt?: string | null;
}) {
  const completionCriteria = step.completionCriteria.join("; ");
  const unresolvedChecks = stateChecks
    .filter((check) => check.status !== "satisfied")
    .map((check) => check.label);
  const prompt = step.agentPromptTemplate
    .replaceAll("{experimentId}", experiment.id)
    .replaceAll("{userGoal}", step.userGoal)
    .replaceAll("{completionCriteria}", completionCriteria);

  return [
    prompt,
    unresolvedChecks.length > 0
      ? `\nPrivate UI hint: the web page currently considers these items unresolved: ${unresolvedChecks.join(", ")}. Use this only to choose your next question; do not recite it to the user.`
      : "\nPrivate UI hint: the web page currently considers this step ready. Verify through MCP before advancing.",
    `Relevant skills: featbit-release-decision, ${step.skills.join(", ")}`,
    suggestedPrompt ? `\nSpecific task from the web page:\n${suggestedPrompt}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStateChecks(
  step: GuidedExperimentStep,
  experiment: ExperimentWithRuns,
): StateCheck[] {
  const latestRun = getLatestRun(experiment.experimentRuns);
  const variants = parseVariants(experiment.variants);
  const primaryMetric = parsePrimaryMetric(experiment.primaryMetric);
  const guardrails = parseGuardrails(experiment.guardrails);
  const latestDecision = getLatestDecision(experiment.experimentRuns);
  const hasRunLearning = experiment.experimentRuns.some(
    (run) =>
      hasText(run.whatChanged) ||
      hasText(run.whatHappened) ||
      hasText(run.confirmedOrRefuted) ||
      hasText(run.whyItHappened) ||
      hasText(run.nextHypothesis),
  );

  switch (step.key) {
    case "frame":
      return [
        check("Goal", experiment.goal, "Missing business goal"),
        check("Intent", experiment.intent, "Missing user or business intent"),
        check("Change", experiment.change, "Missing proposed change"),
        check("Hypothesis", experiment.hypothesis, "Missing falsifiable hypothesis"),
        check(
          "Constraints / open questions",
          firstText(experiment.constraints, experiment.openQuestions),
          "No constraints captured",
          "warning",
        ),
      ];
    case "exposure":
      return [
        check("Flag key", experiment.flagKey, "No FeatBit flag bound"),
        {
          label: "Actual flag variations",
          value:
            variants.length > 0
              ? variants.map((variant) => variant.key).join(", ")
              : "No FeatBit flag variations stored",
          status: variants.length >= 2 ? "satisfied" : "missing",
        },
        {
          label: "Audience / rollout",
          value: describeAudienceAndRollout(latestRun),
          status: latestRun?.trafficPercent || latestRun?.audienceFilters ? "satisfied" : "warning",
        },
        check(
          "Rollback trigger",
          experiment.constraints,
          "No rollback condition captured",
          "warning",
        ),
        {
          label: "Manual data entry",
          value: "Disabled: variants and evidence must come from FeatBit data",
          status: "satisfied",
        },
      ];
    case "measure":
      return [
        {
          label: "Primary metric",
          value: primaryMetric
            ? [
                primaryMetric.name,
                primaryMetric.event,
                primaryMetric.expectedDirection === "decrease_good"
                  ? "lower is better"
                  : primaryMetric.expectedDirection === "increase_good"
                    ? "higher is better"
                    : null,
              ].filter(Boolean).join(" / ")
            : "No primary metric configured",
          status: primaryMetric?.expectedDirection ? "satisfied" : "missing",
        },
        {
          label: "Guardrails",
          value:
            guardrails.length > 0
              ? guardrails.map((guardrail) => guardrail.name ?? guardrail.event).join(", ")
              : "No guardrails configured",
          status: guardrails.length > 0 ? "satisfied" : "missing",
        },
        {
          label: "Event instrumentation",
          value: primaryMetric?.event
            ? `Primary event: ${primaryMetric.event}`
            : "Primary metric event is missing",
          status: primaryMetric?.event ? "satisfied" : "missing",
        },
        {
          label: "Experiment run status",
          value: latestRun
            ? `${latestRun.slug} is ${latestRun.status}`
            : "No experiment run created",
          status: latestRun ? "satisfied" : "missing",
        },
        {
          label: "Evidence source",
          value: latestRun?.analysisResult
            ? "Analysis result exists from FeatBit data"
            : "Waiting for FeatBit evaluation and metric event analysis",
          status: latestRun?.analysisResult ? "satisfied" : "warning",
        },
      ];
    case "decide":
      return [
        {
          label: "Analysis result",
          value: latestRunWithAnalysis(experiment.experimentRuns)?.analysisResult
            ? "Analysis result is available"
            : "No analysis result available",
          status: latestRunWithAnalysis(experiment.experimentRuns) ? "satisfied" : "missing",
        },
        {
          label: "Decision",
          value: latestDecision?.decision ?? "No release decision recorded",
          status: latestDecision?.decision ? "satisfied" : "missing",
        },
        {
          label: "Decision rationale",
          value: firstText(latestDecision?.decisionSummary, latestDecision?.decisionReason) ?? "No rationale recorded",
          status:
            latestDecision?.decisionSummary || latestDecision?.decisionReason
              ? "satisfied"
              : "warning",
        },
        check("Last learning", experiment.lastLearning, "No cycle learning captured", "warning"),
        {
          label: "Run learning",
          value: hasRunLearning
            ? "Learning fields exist on at least one run"
            : "No run learning captured",
          status: hasRunLearning ? "satisfied" : "warning",
        },
      ];
  }
}

function buildStepReadiness(
  step: GuidedExperimentStep,
  experiment: ExperimentWithRuns,
): StepReadiness {
  const latestRun = getLatestRun(experiment.experimentRuns);
  const variants = parseVariants(experiment.variants);
  const primaryMetric = parsePrimaryMetric(experiment.primaryMetric);
  const guardrails = parseGuardrails(experiment.guardrails);
  const latestDecision = getLatestDecision(experiment.experimentRuns);
  const hasLearning =
    hasText(experiment.lastLearning) ||
    experiment.experimentRuns.some((run) => hasText(run.nextHypothesis));

  switch (step.key) {
    case "frame": {
      const ready = hasText(experiment.goal) && hasText(experiment.hypothesis);
      return {
        canMarkSatisfied: ready,
        summary: ready
          ? "Goal and hypothesis exist. Marking this satisfied moves to exposure control."
          : "Define the goal and falsifiable hypothesis before moving to exposure.",
        blocker: ready ? null : "Missing goal or hypothesis.",
      };
    }
    case "exposure": {
      const ready = hasText(experiment.flagKey) && variants.length >= 2;
      return {
        canMarkSatisfied: ready,
        summary: ready
          ? "A FeatBit flag and actual variations are bound. Marking this satisfied moves to measurement."
          : "Bind a FeatBit flag and use its actual variations before measurement.",
        blocker: ready ? null : "Flag binding or actual flag variations are missing.",
      };
    }
    case "measure": {
      const ready =
        Boolean(primaryMetric?.event) &&
        guardrails.length > 0 &&
        Boolean(latestRun) &&
        Boolean(latestRun?.analysisResult || latestRun?.decision);
      return {
        canMarkSatisfied: ready,
        summary: ready
          ? "Metrics, guardrails, run state, and analysis exist. Marking this satisfied moves to decision and learning."
          : "Configure metrics and run analysis before entering decision and learning.",
        blocker: ready
          ? null
          : "Evidence is not ready. Do not enter decision until a run has analysis or an existing decision.",
      };
    }
    case "decide": {
      const ready = Boolean(latestDecision?.decision && hasLearning);
      return {
        canMarkSatisfied: ready,
        summary: ready
          ? "Decision and learning are captured for this cycle."
          : latestDecision?.decision
            ? "Decision exists. Capture learning before starting the next intent."
            : "A decision is required before learning-capture can close the cycle.",
        blocker: latestDecision?.decision
          ? null
          : "No decision exists yet. Run evidence analysis or wait for sufficient data.",
      };
    }
  }
}

function GuideSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-background/72 p-3 shadow-sm shadow-foreground/5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function CodeBlock({
  value,
  maxLines = 3,
}: {
  value: string;
  maxLines?: number;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-border/80 bg-muted/35 px-2 py-1.5">
      <code
        className="flex-1 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground"
        style={{ maxHeight: `${maxLines * 1.45}rem` }}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
      >
        {copied ? (
          <>
            <Check className="size-3" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}

function check(
  label: string,
  value: string | null | undefined,
  missing: string,
  missingStatus: CheckStatus = "missing",
): StateCheck {
  return {
    label,
    value: hasText(value) ? value!.trim() : missing,
    status: hasText(value) ? "satisfied" : missingStatus,
  };
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => hasText(value))?.trim() ?? null;
}

type VariantRow = { key: string; description?: string };

function parseVariants(variants: string | null | undefined): VariantRow[] {
  if (!variants) return [];
  const raw = variants.trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as Array<{
        key?: string;
        name?: string;
        description?: string;
      }>;
      return parsed
        .map((variant) => ({
          key: variant.key ?? variant.name ?? "",
          description: variant.description,
        }))
        .filter((variant) => variant.key);
    } catch {
      return [];
    }
  }

  return raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.+?)\s*\((.+)\)\s*$/);
      return match
        ? { key: match[1].trim(), description: match[2].trim() }
        : { key: item };
    });
}

type MetricSummary = {
  name?: string;
  event?: string;
  metricType?: string;
  metricAgg?: string;
  expectedDirection?: "increase_good" | "decrease_good";
};

function parsePrimaryMetric(raw: string | null | undefined): MetricSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MetricSummary;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return { name: raw };
  }
  return null;
}

function parseGuardrails(raw: string | null | undefined): MetricSummary[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MetricSummary[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ name: line }));
  }
  return [];
}

function getLatestRun(runs: ExperimentRun[]) {
  return [...runs].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )[0];
}

function latestRunWithAnalysis(runs: ExperimentRun[]) {
  return [...runs]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .find((run) => hasText(run.analysisResult));
}

function getLatestDecision(runs: ExperimentRun[]) {
  return [...runs]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .find((run) => hasText(run.decision));
}

function describeAudienceAndRollout(run: ExperimentRun | undefined) {
  if (!run) return "No run audience or rollout configured";
  const details = [
    run.trafficPercent ? `${run.trafficPercent}% traffic` : null,
    run.audienceFilters ? "audience filters configured" : null,
    run.layerId ? `layer ${run.layerId}` : null,
  ].filter(Boolean);

  return details.length > 0
    ? details.join(", ")
    : "Run exists, but audience and rollout details are incomplete";
}

