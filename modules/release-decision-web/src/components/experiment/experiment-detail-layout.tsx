import { useState, useEffect, useMemo } from "react";
import { Link } from "@/lib/router";
import { ArrowLeft, Settings, Terminal } from "lucide-react";
import { useDashboardHeader } from "@/app/(dashboard)/layout";
import { StageStepper } from "@/components/experiment/stage-bar";
import { StageContentPanel } from "@/components/experiment/stage-content-panel";
import {
  ChatPanel,
  CODING_AGENT_SETUP_DISMISSED_KEY,
} from "@/components/experiment/chat-panel";
import { CodingAgentSetupDialogContent } from "@/components/experiment/coding-agent-setup";
import { ResizablePanels } from "@/components/experiment/resizable-panels";
import { ActivityPopover } from "@/components/experiment/activity-popover";
import { ChatTriggerContext } from "@/components/experiment/chat-trigger-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getGuidedExperimentStep } from "@/lib/guided-experiment-steps";
import type {
  Experiment,
  ExperimentRun,
  Activity,
} from "@/lib/release-decision-types";

type ExperimentWithRelations = Experiment & {
  experimentRuns: ExperimentRun[];
  activities: Activity[];
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
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupPromptOpen, setSetupPromptOpen] = useState(false);
  const [dontPromptSetupAgain, setDontPromptSetupAgain] = useState(false);
  const currentStep = getGuidedExperimentStep(activeTab);

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

  useEffect(() => {
    let shouldOpen = false;
    try {
      shouldOpen =
        window.localStorage.getItem(CODING_AGENT_SETUP_DISMISSED_KEY) !== "true";
    } catch {
      shouldOpen = true;
    }

    if (!shouldOpen) {
      return;
    }

    const timer = window.setTimeout(() => setSetupPromptOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function triggerChat(message: string) {
    void message;
    setSetupDialogOpen(true);
  }

  function rememberSetupPromptPreference() {
    if (!dontPromptSetupAgain) {
      return;
    }

    try {
      window.localStorage.setItem(CODING_AGENT_SETUP_DISMISSED_KEY, "true");
    } catch {
      // Non-critical: the prompt can show again if storage is unavailable.
    }
  }

  const dashboardHeader = useMemo(
    () => (
      <>
        <Link
          href="/"
          className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Experiments
        </Link>
        <span className="h-5 w-px shrink-0 bg-border" />
        <h1 className="min-w-0 truncate text-sm font-bold tracking-tight">
          {experiment.name}
        </h1>

        <div className="ml-2 flex shrink-0 items-center gap-2 border-l border-border/60 pl-3">
          <button
            type="button"
            onClick={() => setSetupDialogOpen(true)}
            title="Coding-agent setup"
            className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background/80 px-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-accent-foreground"
          >
            <Terminal className="size-3" />
            <span>Setup</span>
          </button>
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
      </>
    ),
    [
      activeTab,
      defaultTab,
      experiment.activities,
      experiment.name,
      prevTab,
    ],
  );
  useDashboardHeader(dashboardHeader);

  // All experiments render the guided release-decision stages directly. The
  // old guided/expert entry choice was removed; each stage now carries its own
  // coding-agent prompt and can be skipped when already satisfied.
  return (
    <ChatTriggerContext.Provider value={triggerChat}>
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab !== "settings" && (
          <StageStepper
            experiment={experiment}
            activeTab={activeTab}
            onStageSelect={setActiveTab}
          />
        )}
        <div className="min-h-0 flex-1">
          {activeTab === "settings" ? (
            <StageContentPanel
              experiment={experiment}
              activeTab={activeTab}
              onStageChange={setActiveTab}
            />
          ) : (
            <ResizablePanels
              defaultLeftRatio={2 / 3}
              minWidth={0}
              left={
                <StageContentPanel
                  experiment={experiment}
                  activeTab={activeTab}
                  onStageChange={setActiveTab}
                />
              }
              right={
                <ChatPanel
                  experiment={experiment}
                  activeStage={activeTab}
                  onStageChange={setActiveTab}
                  onOpenSetup={() => setSetupDialogOpen(true)}
                />
              }
            />
          )}
        </div>
      </main>
      <Dialog open={setupPromptOpen} onOpenChange={setSetupPromptOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Terminal className="size-4 text-primary" />
              Optional coding-agent setup
            </DialogTitle>
            <DialogDescription className="text-xs">
              Prepare a coding agent, install the release-decision skill, then
              connect FeatBit MCP when you want the agent to read and update
              this experiment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border/80 bg-muted/25 px-3 py-2.5">
              <div className="text-xs font-semibold text-foreground">
                Current step
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {currentStep.title}: {currentStep.userGoal}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={dontPromptSetupAgain}
                onChange={(event) => setDontPromptSetupAgain(event.target.checked)}
                className="size-3.5 rounded border-border"
              />
              Do not show this setup prompt again
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                rememberSetupPromptPreference();
                setSetupPromptOpen(false);
              }}
            >
              Skip
            </Button>
            <Button
              onClick={() => {
                rememberSetupPromptPreference();
                setSetupDialogOpen(true);
                setSetupPromptOpen(false);
              }}
            >
              Open setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Terminal className="size-4 text-primary" />
              Coding-agent setup
            </DialogTitle>
            <DialogDescription className="text-xs">
              Prepare the coding agent, install the release-decision skill, and
              connect FeatBit MCP for this experiment.
            </DialogDescription>
          </DialogHeader>
          <CodingAgentSetupDialogContent experiment={experiment} />
        </DialogContent>
      </Dialog>
    </ChatTriggerContext.Provider>
  );
}
