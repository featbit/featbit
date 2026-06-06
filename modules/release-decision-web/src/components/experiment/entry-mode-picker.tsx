"use client";

import { useState } from "react";
import { Bot, ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateExperiment } from "@/lib/release-decision-client-data";
import { cn } from "@/lib/utils";
import type { Experiment, ExperimentRun } from "@/generated/prisma";

type Mode = "guided";

/**
 * Start screen rendered when an experiment has no entryMode yet.
 * The old expert/manual-data entry path has been folded into the guided
 * release-decision workflow; setup fields are handled by the stage panels and
 * coding-agent prompts.
 */
export function EntryModePicker({
  experiment,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  onExperimentUpdated?: () => Promise<unknown>;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-8 space-y-6">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold">How would you like to start?</h2>
          <p className="text-sm text-muted-foreground">
            Do you already have a clear experiment plan, or would you like the
            agent to guide you through a scientific controlled experiment?
          </p>
        </header>

        <ModeCards
          experiment={experiment}
          currentMode={null}
          onExperimentUpdated={onExperimentUpdated}
        />

        <p className="text-xs text-muted-foreground">
          The workflow uses FeatBit managed feature-flag evaluations and metric
          events for analysis. Third-party API evidence can be planned, but is
          not supported for live analysis yet.
        </p>
      </div>
    </div>
  );
}

/**
 * Dialog variant — used from the experiment detail header to let the user
 * switch modes mid-experiment without losing data.
 */
export function ModeSwitchDialog({
  experiment,
  currentMode,
  open,
  onOpenChange,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  currentMode: Mode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onExperimentUpdated?: () => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Guided workflow</DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            Release-decision setup now follows one guided workflow. Analysis
            uses FeatBit managed flag and metric data.
          </p>
        </DialogHeader>
        <ModeCards
          experiment={experiment}
          currentMode={currentMode}
          onAfterSelect={() => onOpenChange(false)}
          onExperimentUpdated={onExperimentUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ── Shared card pair ── */
function ModeCards({
  experiment,
  currentMode,
  onAfterSelect,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  currentMode: Mode | null;
  onAfterSelect?: () => void;
  onExperimentUpdated?: () => Promise<unknown>;
}) {
  const [selecting, setSelecting] = useState<Mode | null>(null);

  async function pickGuided() {
    if (currentMode === "guided") {
      onAfterSelect?.();
      return;
    }
    setSelecting("guided");
    try {
      await updateExperiment(experiment.id, { entryMode: "guided" });
      await onExperimentUpdated?.();
      onAfterSelect?.();
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="grid gap-4">
      <ModeCard
        title="Start guided workflow"
        subtitle="FeatBit release-decision flow"
        description="Use the coding-agent guide to shape intent, define a hypothesis, configure exposure, select metrics, analyze FeatBit managed evidence, and capture learning."
        icon={<Bot className="size-5" />}
        cta={currentMode === "guided" ? "Currently active" : "Start workflow"}
        active={currentMode === "guided"}
        disabled={selecting !== null}
        loading={selecting === "guided"}
        onClick={pickGuided}
      />
    </div>
  );
}

function ModeCard({
  title,
  subtitle,
  description,
  icon,
  cta,
  onClick,
  active,
  disabled,
  loading,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-60 disabled:cursor-wait",
        active
          ? "border-foreground/60 bg-muted/40"
          : "hover:border-foreground/30 hover:bg-muted/30",
      )}
    >
      {active && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-medium text-foreground/70">
          <Check className="size-3" />
          Active
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-md bg-foreground/5">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="flex items-center gap-1 text-xs font-medium text-foreground/80 group-hover:text-foreground">
        {loading ? "Switching…" : cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
