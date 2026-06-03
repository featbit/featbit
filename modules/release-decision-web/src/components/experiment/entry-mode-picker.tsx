"use client";

import { useState } from "react";
import { Bot, FlaskConical, ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateExperiment } from "@/lib/release-decision-client-data";
import { ExpertSetupDialog } from "./expert-setup-dialog";
import { cn } from "@/lib/utils";
import type { Experiment, ExperimentRun } from "@/generated/prisma";

type Mode = "guided" | "expert";

/**
 * Choice screen rendered when an experiment has no entryMode yet.
 * Mode 1 (guided) → AI-chat walks user through the full decision framework.
 * Mode 2 (expert) → user fills algorithm / metrics / priors directly.
 */
export function EntryModePicker({
  experiment,
  onExpertSaved,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  onExpertSaved?: (chatSummary: string) => void;
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
          onExpertSaved={onExpertSaved}
          onExperimentUpdated={onExperimentUpdated}
        />

        <p className="text-xs text-muted-foreground">
          Expert setup can be edited later — the same underlying fields power
          both modes, so nothing you enter is thrown away.
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
  onExpertSaved,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  currentMode: Mode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onExpertSaved?: (chatSummary: string) => void;
  onExperimentUpdated?: () => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Switch setup mode</DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            Your data is preserved either way — algorithm, metrics, guardrails,
            priors, and any observed data move across modes.
          </p>
        </DialogHeader>
        <ModeCards
          experiment={experiment}
          currentMode={currentMode}
          onAfterSelect={() => onOpenChange(false)}
          onExpertSaved={onExpertSaved}
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
  onExpertSaved,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  currentMode: Mode | null;
  onAfterSelect?: () => void;
  onExpertSaved?: (chatSummary: string) => void;
  onExperimentUpdated?: () => Promise<unknown>;
}) {
  const [expertOpen, setExpertOpen] = useState(false);
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

  function pickExpert() {
    if (currentMode === "expert") {
      // Already in expert mode — just reopen the wizard to edit.
      setExpertOpen(true);
      return;
    }
    // Opening the wizard; it flips entryMode on save (see saveExpertSetupAction).
    setExpertOpen(true);
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <ModeCard
          title="Guide me with AI"
          subtitle="Chat-driven setup"
          description="Reopen the agent chat to shape intent, design a hypothesis, or adjust metrics step by step."
          icon={<Bot className="size-5" />}
          cta={currentMode === "guided" ? "Currently active" : "Use guided mode"}
          active={currentMode === "guided"}
          disabled={selecting !== null}
          loading={selecting === "guided"}
          onClick={pickGuided}
        />
        <ModeCard
          title="I know what I want"
          subtitle="Expert setup form"
          description="Pick the algorithm, configure the primary metric, guardrails, prior, and minimum sample directly. Paste observed data now or later."
          icon={<FlaskConical className="size-5" />}
          cta={currentMode === "expert" ? "Edit expert setup" : "Use expert mode"}
          active={currentMode === "expert"}
          disabled={selecting !== null}
          onClick={pickExpert}
        />
      </div>

      <ExpertSetupDialog
        experiment={experiment}
        open={expertOpen}
        onOpenChange={(v) => {
          setExpertOpen(v);
          if (!v) onAfterSelect?.();
        }}
        onSaved={onExpertSaved}
        onExperimentUpdated={onExperimentUpdated}
      />
    </>
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
