import { useState, useEffect } from "react";
import {
  Bot,
  ListChecks,
  ScrollText,
  Settings,
  Terminal,
  UserRound,
} from "lucide-react";
import { StageStepper } from "@/components/experiment/stage-bar";
import { StageContentPanel } from "@/components/experiment/stage-content-panel";
import { CodingAgentSetupDialogContent } from "@/components/experiment/coding-agent-setup";
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

const CODING_AGENT_SETUP_DISMISSED_KEY =
  "featbit:coding-agent-setup:dismissed";

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
  const [lastStepTab, setLastStepTab] = useState(defaultTab);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupPromptOpen, setSetupPromptOpen] = useState(false);
  const [dontPromptSetupAgain, setDontPromptSetupAgain] = useState(false);
  const currentStep = getGuidedExperimentStep(lastStepTab);
  const isStepsPage = isReleaseDecisionStep(activeTab);

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

  function toggleSettings() {
    if (activeTab === "settings") {
      setActiveTab(lastStepTab);
      return;
    }

    setActiveTab("settings");
  }

  function openSteps() {
    setActiveTab(lastStepTab);
  }

  function selectStep(stageKey: string) {
    setLastStepTab(stageKey);
    setActiveTab(stageKey);
  }

  function openAuditLog() {
    setActiveTab("audit");
  }

  // All experiments render the guided release-decision stages directly. The
  // old guided/expert entry choice was removed; each stage now carries its own
  // coding-agent prompt and can be skipped when already satisfied.
  return (
    <>
      <main className="flex h-full min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-44 shrink-0 flex-col border-r border-border/70 bg-background/45 p-3 backdrop-blur-xl">
          <div className="border-b border-border/70 pb-3">
            <div className="min-w-0">
              <h5 className="rd-heading-label">
                Experiment
              </h5>
              <h1 className="rd-heading-page mt-1" title={experiment.name}>
                {experiment.name}
              </h1>
            </div>
          </div>

          <nav className="mt-3 space-y-1">
            <button
              type="button"
              onClick={openSteps}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium transition-colors",
                isStepsPage
                  ? "bg-foreground text-background shadow-sm shadow-foreground/10"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <ListChecks className="size-3.5" />
              <span>Steps</span>
            </button>
            <button
              type="button"
              onClick={() => setSetupDialogOpen(true)}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Terminal className="size-3.5" />
              <span>Agent Setup Guide</span>
            </button>
            <button
              type="button"
              onClick={toggleSettings}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium transition-colors",
                activeTab === "settings"
                  ? "bg-foreground text-background shadow-sm shadow-foreground/10"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Settings className="size-3.5" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              onClick={openAuditLog}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium transition-colors",
                activeTab === "audit"
                  ? "bg-foreground text-background shadow-sm shadow-foreground/10"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <ScrollText className="size-3.5" />
              <span className="min-w-0 flex-1 truncate">Audit log</span>
              {experiment.activities.length > 0 && (
                <span
                  className={cn(
                    "rounded px-1 text-[10px] tabular-nums",
                    activeTab === "audit" ? "bg-background/20" : "bg-muted",
                  )}
                >
                  {experiment.activities.length}
                </span>
              )}
            </button>
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {isStepsPage && (
            <StageStepper
              experiment={experiment}
              activeTab={activeTab}
              onStageSelect={selectStep}
            />
          )}
          <div className="min-h-0 flex-1">
            {activeTab === "audit" ? (
              <AuditLogPanel activities={experiment.activities} />
            ) : (
              <StageContentPanel
                experiment={experiment}
                activeTab={activeTab}
                onStageChange={selectStep}
              />
            )}
          </div>
        </section>
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
              <h4 className="rd-heading-subsection">
                Current step
              </h4>
              <h5 className="rd-heading-subtitle mt-1">
                {currentStep.title}: {currentStep.userGoal}
              </h5>
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
    </>
  );
}

function AuditLogPanel({ activities }: { activities: Activity[] }) {
  const ordered = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <ScrollText className="size-4 text-muted-foreground" />
            <h2 className="rd-heading-section">Audit log</h2>
          </div>
          <h3 className="rd-heading-subtitle mt-1">
            Timeline of experiment changes, analysis actions, and stage updates.
          </h3>
        </div>

        {ordered.length === 0 ? (
          <div className="rounded-md border border-dashed bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No audit events yet.
          </div>
        ) : (
          <div className="rounded-md border bg-background/55">
            {ordered.map((activity, index) => {
              const actor = getActivityActor(activity);
              const time = new Date(activity.createdAt);
              return (
                <div
                  key={activity.id}
                  className={cn(
                    "grid grid-cols-[9rem_1fr] gap-4 px-4 py-3 text-sm",
                    index !== 0 && "border-t",
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    <div suppressHydrationWarning>{time.toLocaleDateString()}</div>
                    <div className="tabular-nums" suppressHydrationWarning>
                      {time.toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded border bg-muted/35 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {actor.kind === "system" ? (
                          <Bot className="size-3" />
                        ) : (
                          <UserRound className="size-3" />
                        )}
                        {actor.label}
                      </span>
                      <h5 className="rd-heading-field rounded bg-muted px-1.5 py-0.5">
                        {formatActivityType(activity.type)}
                      </h5>
                      {actor.email && actor.email !== actor.label && (
                        <span className="text-xs text-muted-foreground">
                          {actor.email}
                        </span>
                      )}
                    </div>
                    <h4 className="rd-heading-subsection mt-1">
                      {actor.label} performed: {activity.title}
                    </h4>
                    {activity.detail && (
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {activity.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function isReleaseDecisionStep(tab: string): boolean {
  return getGuidedExperimentStep(tab).stageKey === tab;
}

function getActivityActor(activity: Activity): {
  kind: "user" | "system";
  label: string;
  email: string | null;
} {
  if (activity.actorName || activity.actorEmail) {
    return {
      kind: activity.actorType === "system" ? "system" : "user",
      label: activity.actorName ?? activity.actorEmail ?? "Unknown actor",
      email: activity.actorEmail,
    };
  }

  return { kind: "system", label: "Unknown actor", email: null };
}

function formatActivityType(type: string): string {
  return (type || "event").replace(/_/g, " ");
}
