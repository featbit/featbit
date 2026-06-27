import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { Experiment, ExperimentRun } from "@/lib/release-decision-types";

type ExperimentLike = Experiment & { experimentRuns: ExperimentRun[] };

/** Determine whether a stage has any content filled in. */
function stageHasContent(experiment: ExperimentLike, stageKey: string): boolean {
  switch (stageKey) {
    case "hypothesis":
      return Boolean(experiment.goal || experiment.intent || experiment.hypothesis || experiment.change || experiment.constraints);
    case "implementing":
      return Boolean(experiment.flagKey || experiment.variants);
    case "measuring":
      return Boolean(
        experiment.primaryMetric ||
          experiment.guardrails ||
          experiment.experimentRuns.length > 0 ||
          experiment.experimentRuns.some((e) => e.decision)
      );
    case "learning":
      return Boolean(
        experiment.lastLearning ||
          experiment.experimentRuns.some(
            (e) => e.whatChanged || e.whatHappened || e.nextHypothesis
          )
      );
    default:
      return false;
  }
}

interface StageStepperProps {
  experiment: ExperimentLike;
  activeTab: string;
  onStageSelect: (stageKey: string) => void;
}

// Chevron arrow-tip width in pixels. Each middle step has a right-pointing tip
// and a matching left notch so neighbors interlock.
const POINT = 10;

function chevronClip(isFirst: boolean, isLast: boolean): string | undefined {
  if (isFirst && isLast) return undefined;
  if (isFirst)
    return `polygon(0 0, calc(100% - ${POINT}px) 0, 100% 50%, calc(100% - ${POINT}px) 100%, 0 100%)`;
  if (isLast)
    return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${POINT}px 50%)`;
  return `polygon(0 0, calc(100% - ${POINT}px) 0, 100% 50%, calc(100% - ${POINT}px) 100%, 0 100%, ${POINT}px 50%)`;
}

export function StageStepper({
  experiment,
  activeTab,
  onStageSelect,
}: StageStepperProps) {
  return (
    <nav className="flex items-stretch gap-0.5 border-b border-border/70 bg-background/55 px-2 py-2 backdrop-blur-xl shrink-0">
      {STAGES.map((stage, i) => {
        const isSelected = stage.key === activeTab;
        const hasContent = stageHasContent(experiment, stage.key);
        const isFirst = i === 0;
        const isLast = i === STAGES.length - 1;
        const clipPath = chevronClip(isFirst, isLast);

        return (
          <button
            key={stage.key}
            type="button"
            onClick={() => onStageSelect(stage.key)}
            style={{ clipPath }}
            className={cn(
              "flex-1 flex flex-col justify-center py-2 text-left transition-all cursor-pointer min-w-0 leading-tight",
              isFirst ? "pl-4" : "pl-6",
              isLast ? "pr-4" : "pr-6",
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 -translate-y-px"
                : "bg-card/70 text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
            )}
          >
            <h2 className="rd-stepper-title flex items-center gap-2 w-full min-w-0">
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  hasContent
                    ? isSelected
                      ? "bg-background"
                      : "bg-foreground"
                    : isSelected
                      ? "bg-background/40"
                      : "bg-muted-foreground/30"
                )}
              />
              <span className="truncate">{stage.label}</span>
            </h2>
            <h3
              className={cn(
                "rd-stepper-subtitle mt-0.5 pl-3.5 truncate w-full",
                isSelected
                  ? "text-background/70"
                  : "text-muted-foreground/75"
              )}
            >
              {stage.cf} · {stage.description}
            </h3>
          </button>
        );
      })}
    </nav>
  );
}
