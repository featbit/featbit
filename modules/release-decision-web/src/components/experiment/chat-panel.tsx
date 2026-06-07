"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Database,
  KeyRound,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Terminal,
  Trash2,
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
import { apiRequest, FeatBitApiError } from "@/lib/featbit-auth/http";
import { updateExperimentStage } from "@/lib/release-decision-client-data";
import {
  getGuidedExperimentStep,
  type GuidedExperimentStep,
} from "@/lib/guided-experiment-steps";
import { cn } from "@/lib/utils";
import type { Experiment, ExperimentRun } from "@/generated/prisma";

const MCP_TOKEN_STORAGE_KEY = "featbit:mcp-token:last";
export const CODING_AGENT_SETUP_DISMISSED_KEY =
  "featbit:coding-agent-setup:dismissed";

type McpDeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type McpTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type StoredMcpToken = McpTokenResponse & {
  created_at: string;
  expires_at: string;
  env_id: string;
};

type ShellId = "powershell" | "bash" | "zsh";
type AgentId = "codex" | "claude" | "opencode" | "copilot" | "generic";
type CheckStatus = "satisfied" | "missing" | "warning";
type StepKey = GuidedExperimentStep["key"];

type ExperimentWithRuns = Experiment & {
  experimentRuns: ExperimentRun[];
};

type TabOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
};

type ShellOption = {
  id: ShellId;
  label: string;
  description: string;
  command: string;
  maxLines?: number;
};

type AgentOption = TabOption<AgentId> & {
  commandTitle: string;
  commandHelp: string;
  commandValue: string;
  commandMaxLines?: number;
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
  setupExpanded,
  onSetupExpandedChange,
}: {
  experiment: ExperimentWithRuns;
  activeStage: string;
  suggestedPrompt?: string | null;
  onStageChange?: (stageKey: string) => void;
  setupExpanded?: boolean;
  onSetupExpandedChange?: (expanded: boolean) => void;
}) {
  const envId = experiment.featbitEnvId;
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
  const manualAction = getManualAction(step.key, readiness);

  const [token, setToken] = useState<StoredMcpToken | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [revokingToken, setRevokingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [selectedShell, setSelectedShell] = useState<ShellId>("powershell");
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("codex");
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MCP_TOKEN_STORAGE_KEY);
      if (stored) {
        setToken(JSON.parse(stored) as StoredMcpToken);
      }
    } catch {
      window.localStorage.removeItem(MCP_TOKEN_STORAGE_KEY);
    }
  }, []);

  const tokenValue = token?.access_token ?? "<create-token-first>";
  const powerShellToken = quotePowerShell(tokenValue);
  const shellToken = quotePosixShell(tokenValue);
  const powerShellCommand = `$env:FEATBIT_MCP_TOKEN="${powerShellToken}"`;
  const bashCommand = `export FEATBIT_MCP_TOKEN='${shellToken}'`;
  const zshCommand = `export FEATBIT_MCP_TOKEN='${shellToken}'`;
  const addServerCommand =
    "codex mcp add featbit-experimentation --url http://localhost:5000/mcp --bearer-token-env-var FEATBIT_MCP_TOKEN";
  const genericMcpConfig = `{
  "mcpServers": {
    "featbit-experimentation": {
      "type": "http",
      "url": "http://localhost:5000/mcp",
      "headers": {
        "Authorization": "Bearer \${FEATBIT_MCP_TOKEN}"
      }
    }
  }
}`;
  const tokenLifetimeLabel = token ? formatDuration(token.expires_in) : null;
  const skillInstallCommand = "npx skills add featbit/featbit-release-decision-skills";
  const skillUpdateCommand = "npx skills update featbit/featbit-release-decision-skills";
  const codexStartCommand = `$env:FEATBIT_MCP_TOKEN="${powerShellToken}"; codex`;
  const codexResumeCommand = `$env:FEATBIT_MCP_TOKEN="${powerShellToken}"; codex resume <conversation-id>`;
  const tokenExpired = token ? new Date(token.expires_at).getTime() <= Date.now() : false;
  const shellOptions: ShellOption[] = [
    {
      id: "powershell",
      label: "PowerShell",
      description: "Use this before starting the agent from PowerShell.",
      command: powerShellCommand,
    },
    {
      id: "bash",
      label: "bash",
      description: "Use this before starting the agent from bash.",
      command: bashCommand,
    },
    {
      id: "zsh",
      label: "zsh",
      description: "Use this before starting the agent from zsh.",
      command: zshCommand,
    },
  ];
  const selectedShellOption =
    shellOptions.find((option) => option.id === selectedShell) ?? shellOptions[0];
  const agentOptions: AgentOption[] = [
    {
      id: "codex",
      label: "Codex",
      description: "Use your current Codex conversation.",
      commandTitle: "Codex MCP registration",
      commandHelp:
        "Run once. Codex stores the server URL and the token environment-variable name; the token itself is pasted in the start/resume command below.",
      commandValue: addServerCommand,
      commandMaxLines: 3,
    },
    {
      id: "claude",
      label: "Claude Code",
      description: "Use HTTP MCP config.",
      commandTitle: "Claude Code MCP config",
      commandHelp: "Add this server definition to your Claude Code MCP settings.",
      commandValue: genericMcpConfig,
      commandMaxLines: 8,
    },
    {
      id: "opencode",
      label: "OpenCode",
      description: "Use HTTP MCP config.",
      commandTitle: "OpenCode MCP config",
      commandHelp: "Add this server definition to your OpenCode MCP settings.",
      commandValue: genericMcpConfig,
      commandMaxLines: 8,
    },
    {
      id: "copilot",
      label: "Copilot CLI",
      description: "Use HTTP MCP config.",
      commandTitle: "Copilot CLI MCP config",
      commandHelp: "Add this server definition where Copilot CLI reads MCP servers.",
      commandValue: genericMcpConfig,
      commandMaxLines: 8,
    },
    {
      id: "generic",
      label: "Generic MCP",
      description: "Any HTTP MCP-capable agent.",
      commandTitle: "HTTP MCP server config",
      commandHelp: "Use environment-variable or secret expansion for the bearer token.",
      commandValue: genericMcpConfig,
      commandMaxLines: 8,
    },
  ];
  const selectedAgentOption =
    agentOptions.find((option) => option.id === selectedAgent) ?? agentOptions[0];

  async function createScopedToken() {
    if (!envId) {
      setTokenError("This experiment is not bound to a FeatBit environment yet.");
      return;
    }

    setLoadingToken(true);
    setTokenError(null);

    try {
      const device = await apiRequest<McpDeviceCodeResponse>(
        "/mcp/oauth/device/code",
        {
          method: "POST",
          skipAuth: true,
          body: {
            client_id: "featbit-coding-agent",
            env_id: envId,
          },
        },
      );

      await apiRequest(
        `/envs/${envId}/release-decision/mcp/oauth/device/authorize`,
        {
          method: "POST",
          body: { user_code: device.user_code },
        },
      );

      const nextToken = await apiRequest<McpTokenResponse>("/mcp/oauth/token", {
        method: "POST",
        skipAuth: true,
        body: {
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: device.device_code,
          client_id: "featbit-coding-agent",
        },
      });

      const createdAt = new Date();
      const storedToken: StoredMcpToken = {
        ...nextToken,
        created_at: createdAt.toISOString(),
        expires_at: new Date(createdAt.getTime() + nextToken.expires_in * 1000).toISOString(),
        env_id: envId,
      };

      window.localStorage.setItem(MCP_TOKEN_STORAGE_KEY, JSON.stringify(storedToken));
      setToken(storedToken);
    } catch (error) {
      setTokenError(
        error instanceof FeatBitApiError || error instanceof Error
          ? error.message
          : "Failed to create the MCP token.",
      );
    } finally {
      setLoadingToken(false);
    }
  }

  async function revokeSavedToken() {
    if (!token?.access_token) {
      return;
    }

    setRevokingToken(true);
    setTokenError(null);

    try {
      await apiRequest("/mcp/oauth/revoke", {
        method: "POST",
        skipAuth: true,
        body: { access_token: token.access_token },
      });

      window.localStorage.removeItem(MCP_TOKEN_STORAGE_KEY);
      setToken(null);
    } catch (error) {
      setTokenError(
        error instanceof FeatBitApiError || error instanceof Error
          ? error.message
          : "Failed to revoke the MCP token.",
      );
    } finally {
      setRevokingToken(false);
    }
  }

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
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Follow a professional release-decision loop. A coding agent can help,
          but the stage panel remains fully usable without one.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <GuideSection
          icon={<ClipboardCheck className="size-4" />}
          title={step.title}
        >
          <p>{step.userGoal}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {step.cfTriggers.map((trigger) => (
              <span
                key={trigger}
                className="rounded border border-border/80 bg-muted/35 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {trigger}
              </span>
            ))}
          </div>
        </GuideSection>

        <GuideSection
          icon={<ShieldCheck className="size-4" />}
          title="Professional checklist"
        >
          <ul className="space-y-1.5">
            {step.completionCriteria.map((criterion) => (
              <li key={criterion} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                <span>{criterion}</span>
              </li>
            ))}
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Database className="size-4" />}
          title="Current state from MCP"
        >
          <div className="space-y-2">
            {stateChecks.map((check) => (
              <StateCheckRow key={check.label} check={check} />
            ))}
          </div>
        </GuideSection>

        <GuideSection
          icon={<MessageSquareText className="size-4" />}
          title="Recommended action"
        >
          <p>{manualAction}</p>
          {readiness.blocker && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              {readiness.blocker}
            </p>
          )}
          {step.nextStageKey ? (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={markStepSatisfied}
                disabled={!readiness.canMarkSatisfied || advancing}
                className="h-8 gap-1.5"
              >
                {advancing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Mark as already satisfied
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
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              Coding agent prompt
            </p>
            <CodeBlock value={prompt} maxLines={10} />
          </div>
        </GuideSection>

        <details
          open={setupExpanded}
          onToggle={(event) =>
            onSetupExpandedChange?.(event.currentTarget.open)
          }
          className="rounded-lg border border-border/80 bg-background/72 shadow-sm shadow-foreground/5"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
            <Terminal className="size-4 text-primary" />
            Optional coding-agent setup
          </summary>
          <div className="space-y-4 border-t border-border/70 p-3">
            <GuideSection
              icon={<KeyRound className="size-4" />}
              title="Create or revoke your MCP token"
            >
              <p>
                The token uses your FeatBit user permissions across this
                workspace.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={createScopedToken}
                  disabled={loadingToken || !envId}
                  className="h-8"
                >
                  <KeyRound className="size-3.5" />
                  {loadingToken ? "Creating token..." : "Create MCP token"}
                </Button>
                {token?.access_token && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={revokeSavedToken}
                    disabled={revokingToken}
                    className="h-8 border-destructive/35 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    {revokingToken ? "Revoking..." : "Revoke saved token"}
                  </Button>
                )}
                {!envId && (
                  <span className="text-xs text-destructive">
                    Bind a FeatBit environment before connecting an agent.
                  </span>
                )}
              </div>
              {tokenError && (
                <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  {tokenError}
                </p>
              )}
              {token?.access_token && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Last token created {formatDate(token.created_at)}.{" "}
                    {tokenExpired
                      ? "It is expired; create a new one before using MCP."
                      : `It expires ${formatDate(token.expires_at)} (${tokenLifetimeLabel}).`}
                  </p>
                  <CodeBlock value={token.access_token} maxLines={3} />
                </div>
              )}
            </GuideSection>

            <GuideSection
              icon={<Terminal className="size-4" />}
              title="Prepare the agent token"
            >
              {selectedAgent === "codex" ? (
                <>
                  <p>
                    For Codex, run the MCP registration first, then copy one of
                    these commands.
                  </p>
                  <div className="mt-3 space-y-3">
                    <CommandGroup title="Start fresh Codex with this token">
                      <CodeBlock value={codexStartCommand} maxLines={3} />
                    </CommandGroup>
                    <CommandGroup title="Resume Codex with this token">
                      <p className="mb-2">
                        Replace <code>&lt;conversation-id&gt;</code> with the
                        resume id printed by Codex.
                      </p>
                      <CodeBlock value={codexResumeCommand} maxLines={3} />
                    </CommandGroup>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Pick the shell where your coding agent runs, then copy the
                    token command before starting the agent.
                  </p>
                  <div className="mt-3 space-y-3">
                    <SegmentedTabs
                      ariaLabel="Shell"
                      options={shellOptions.map(({ id, label }) => ({
                        id,
                        label,
                      }))}
                      value={selectedShell}
                      onChange={setSelectedShell}
                    />
                    <div className="rounded-md border border-border/80 bg-muted/20 p-2.5">
                      <p className="text-xs text-muted-foreground">
                        {selectedShellOption.description}
                      </p>
                      <div className="mt-2">
                        <CodeBlock
                          value={selectedShellOption.command}
                          maxLines={selectedShellOption.maxLines}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </GuideSection>

            <GuideSection
              icon={<LockKeyhole className="size-4" />}
              title="Register FeatBit MCP"
            >
              <p>
                Pick your coding agent and copy the matching MCP registration
                or server config.
              </p>
              <div className="mt-3 space-y-3">
                <SegmentedTabs
                  ariaLabel="Coding agent"
                  options={agentOptions}
                  value={selectedAgent}
                  onChange={setSelectedAgent}
                />
                <CommandGroup title={selectedAgentOption.commandTitle}>
                  <p className="mb-2">{selectedAgentOption.commandHelp}</p>
                  <CodeBlock
                    value={selectedAgentOption.commandValue}
                    maxLines={selectedAgentOption.commandMaxLines}
                  />
                </CommandGroup>
              </div>
            </GuideSection>

            <GuideSection
              icon={<ClipboardList className="size-4" />}
              title="Install or update the skills"
            >
              <p>
                Skills define how the agent should reason about release
                decisions. MCP owns FeatBit reads and writes.
              </p>
              <div className="mt-3 space-y-2">
                <CodeBlock value={skillInstallCommand} />
                <CodeBlock value={skillUpdateCommand} />
              </div>
            </GuideSection>
          </div>
        </details>
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
            variant="outline"
            onClick={markStepSatisfied}
            disabled={!readiness.canMarkSatisfied || advancing}
            className="h-8 shrink-0 gap-1.5"
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
            ? [primaryMetric.name, primaryMetric.event].filter(Boolean).join(" / ")
            : "No primary metric configured",
          status: primaryMetric ? "satisfied" : "missing",
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

function getManualAction(stepKey: StepKey, readiness: StepReadiness) {
  if (readiness.canMarkSatisfied) {
    return readiness.summary;
  }

  switch (stepKey) {
    case "frame":
      return "Use the left stage panel to fill in the goal, intent, change, and hypothesis. The experiment can continue without a coding agent.";
    case "exposure":
      return "Connect a FeatBit feature flag from the Exposure stage. Variations must come from the flag picker, not from manual entry.";
    case "measure":
      return "Configure one primary metric, guardrails, and a run. Then analyze FeatBit evaluation and metric event data from the run table.";
    case "decide":
      return "Review the run analysis. If evidence is insufficient, keep collecting data instead of forcing a decision; if a decision exists, capture learning.";
  }
}

function StateCheckRow({ check }: { check: StateCheck }) {
  const statusClass =
    check.status === "satisfied"
      ? "text-emerald-600 dark:text-emerald-400"
      : check.status === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
  const Icon = check.status === "satisfied" ? CheckCircle2 : AlertCircle;

  return (
    <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-3.5 shrink-0", statusClass)} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">{check.label}</div>
          <div className="break-words text-xs text-muted-foreground">{check.value}</div>
        </div>
      </div>
    </div>
  );
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

function CommandGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-2.5">
      <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

function SegmentedTabs<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-md border border-border/80 bg-background/65 p-1"
    >
      {options.map((option) => {
        const selected = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={option.description}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-h-7 rounded px-2.5 text-xs font-medium transition-colors",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
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

function quotePowerShell(value: string) {
  return value.replace(/`/g, "``").replace(/"/g, '`"');
}

function quotePosixShell(value: string) {
  return value.replace(/'/g, "'\"'\"'");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
