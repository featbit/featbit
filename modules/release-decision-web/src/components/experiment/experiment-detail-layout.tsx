"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StageStepper } from "@/components/experiment/stage-bar";
import { StageContentPanel } from "@/components/experiment/stage-content-panel";
import { ChatPanel } from "@/components/experiment/chat-panel";
import { ResizablePanels } from "@/components/experiment/resizable-panels";
import { ActivityPopover } from "@/components/experiment/activity-popover";
import { ChatTriggerContext } from "@/components/experiment/chat-trigger-context";
import { EntryModePicker } from "@/components/experiment/entry-mode-picker";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type {
  Experiment,
  ExperimentRun,
  Activity,
  Message,
} from "@/generated/prisma";

type ExperimentWithRelations = Experiment & {
  experimentRuns: ExperimentRun[];
  activities: Activity[];
  messages: Message[];
};

interface ExperimentDetailLayoutProps {
  experiment: ExperimentWithRelations;
  onExperimentUpdated?: () => Promise<ExperimentWithRelations>;
}

export function ExperimentDetailLayout({
  experiment,
  onExperimentUpdated,
}: ExperimentDetailLayoutProps) {
  const defaultTab =
    experiment.stage === "intent" ? "hypothesis" : experiment.stage;
  const [activeTab, setActiveTab] = useState(defaultTab);
  // Remember the stage we were on before hopping into Settings, so the
  // toggle on the Settings button can take us back.
  const [prevTab, setPrevTab] = useState<string | null>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [suggestedCodexPrompt, setSuggestedCodexPrompt] = useState<string | null>(null);

  // Experiments created before this feature have entryMode=null and existing
  // content (messages, runs, stage != initial) — treat those as "guided" so we
  // don't interrupt legacy experiments with the picker.
  const hasPriorWork =
    experiment.messages.length > 0 ||
    experiment.experimentRuns.length > 0 ||
    !!experiment.hypothesis ||
    !!experiment.intent;
  const entryMode: "guided" | null =
    experiment.entryMode === "guided" || experiment.entryMode === "expert"
      ? "guided"
      : hasPriorWork
        ? "guided"
        : null;

  // Auto-refresh every 15 seconds to pick up new analysis results from the Worker
  useEffect(() => {
    if (!onExperimentUpdated) return;

    const id = setInterval(() => {
      void onExperimentUpdated().catch(() => {
        // The detail route may become stale after the experiment is deleted.
        // The owner component handles navigation for that case.
      });
    }, 15_000);
    return () => clearInterval(id);
  }, [onExperimentUpdated]);

  function triggerChat(message: string) {
    setSuggestedCodexPrompt(message);
    setRightCollapsed(false);
  }

  const header = (
    <header className="shrink-0 border-b border-border/70 bg-background/78 shadow-sm shadow-foreground/5 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Link
          href="/experiments"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Experiments
        </Link>
        <span className="h-5 w-px bg-border" />
        <h1 className="text-sm font-bold tracking-tight truncate">{experiment.name}</h1>

        {/* Experiment-scoped actions — grouped next to the name so they stay
            out of the workspace-switcher territory on the right. */}
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border/60">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "settings") {
                setActiveTab(prevTab ?? defaultTab);
                setPrevTab(null);
              } else {
                setPrevTab(activeTab);
                setActiveTab("settings");
              }
            }}
            title={activeTab === "settings" ? "Close settings" : "Experiment settings"}
            className={cn(
              "flex items-center gap-1.5 h-7 rounded-md border px-2 text-xs transition-colors cursor-pointer",
              activeTab === "settings"
                ? "bg-foreground text-background border-foreground shadow-sm shadow-foreground/10"
                : "border-border bg-background/80 text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="size-3" />
            <span>Settings</span>
          </button>
          <ActivityPopover activities={experiment.activities} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <WorkspaceSwitcher readOnly />
        </div>
      </div>
    </header>
  );

  // ── Entry mode not yet selected: show the picker full-width ──
  if (entryMode === null) {
    return (
      <>
        {header}
        <EntryModePicker
          experiment={experiment}
          onExperimentUpdated={onExperimentUpdated}
        />
      </>
    );
  }

  // ── Guided and expert modes both render the stage UI + Codex MCP guide.
  // The only surface-level difference is the header "Edit setup" button
  // (which opens the expert wizard) rendered above. Data is shared. ──
  return (
    <ChatTriggerContext.Provider value={triggerChat}>
      {header}
      <ResizablePanels
        rightCollapsed={rightCollapsed}
        onRightCollapsedChange={setRightCollapsed}
        left={
          <div className="flex flex-col h-full">
            {activeTab !== "settings" && (
              <StageStepper
                experiment={experiment}
                activeTab={activeTab}
                onStageSelect={setActiveTab}
              />
            )}
            <div className="flex-1 min-w-0 min-h-0">
              <StageContentPanel
                experiment={experiment}
                activeTab={activeTab}
              />
            </div>
          </div>
        }
        right={
          <ChatPanel
            experiment={experiment}
            activeStage={activeTab}
            suggestedPrompt={suggestedCodexPrompt}
          />
        }
      />
    </ChatTriggerContext.Provider>
  );
}
