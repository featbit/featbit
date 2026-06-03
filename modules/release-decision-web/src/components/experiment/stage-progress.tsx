"use client";

import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { advanceStageAction } from "@/lib/actions";

export function StageProgress({
  currentStage,
  experimentId,
}: {
  currentStage: string;
  experimentId: string;
}) {
  // Map legacy "intent" stage to merged "hypothesis"
  const effectiveStage = currentStage === "intent" ? "hypothesis" : currentStage;
  const currentIndex = STAGES.findIndex((s) => s.key === effectiveStage);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const isActive = stage.key === currentStage;
          const isCompleted = i < currentIndex;
          return (
            <button
              key={stage.key}
              onClick={() => advanceStageAction(experimentId, stage.key)}
              className={cn(
                "flex-1 group relative flex flex-col items-center gap-1",
              )}
              title={`${stage.cf}: ${stage.description}`}
            >
              {/* Progress bar segment */}
              <div
                className={cn(
                  "h-2 w-full rounded-full transition-colors",
                  isActive && "bg-foreground",
                  isCompleted && "bg-foreground/40",
                  !isActive && !isCompleted && "bg-muted",
                )}
              />
              {/* Label */}
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  isActive
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Current stage detail */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">
          {STAGES[currentIndex]?.cf ?? "CF-01"}
        </span>
        <span>·</span>
        <span>{STAGES[currentIndex]?.description}</span>
        <span>·</span>
        <span className="font-mono text-[10px]">
          {STAGES[currentIndex]?.skill}
        </span>
      </div>
    </div>
  );
}
