"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  Copy,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Terminal,
  Trash2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, FeatBitApiError } from "@/lib/featbit-auth/http";
import { cn } from "@/lib/utils";
import type { Experiment } from "@/generated/prisma";

const MCP_TOKEN_STORAGE_KEY = "featbit:mcp-token:last";

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

export function ChatPanel({
  experiment,
  activeStage,
  suggestedPrompt,
}: {
  experiment: Experiment;
  activeStage: string;
  suggestedPrompt?: string | null;
}) {
  const envId = experiment.featbitEnvId;
  const experimentId = experiment.id;
  const [token, setToken] = useState<StoredMcpToken | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [revokingToken, setRevokingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [selectedShell, setSelectedShell] = useState<ShellId>("powershell");
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("codex");

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

  const basePrompt = useMemo(() => {
    return [
      `Use the $featbit-release-decision skill for experiment ${experimentId}.`,
      "Use FeatBit MCP tools with this experimentId; the API resolves the FeatBit environment from the experiment before checking permissions.",
      "Read the experiment through the FeatBit experimentation MCP server, inspect the current stage and latest run, then recommend the next release decision.",
    ].join("\n");
  }, [experimentId]);
  const stagePrompt = useMemo(() => {
    return buildStagePrompt(activeStage, experimentId);
  }, [activeStage, experimentId]);

  const prompt = suggestedPrompt
    ? `${basePrompt}\n\nSpecific task from the web page:\n${suggestedPrompt}`
    : basePrompt;

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
      commandTitle: "Codex MCP registration (one-time)",
      commandHelp: "Run once. Codex stores the server URL and the token environment-variable name; the token itself is pasted in the start/resume command below.",
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
  const agentStartValue = prompt;

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

  return (
    <aside className="flex h-full flex-col bg-card/55">
      <div className="border-b border-border/70 bg-background/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Workflow className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Use coding agents with this experiment</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Run Codex, Claude Code, OpenCode, Copilot CLI, or another MCP-capable
          coding agent from your own terminal or IDE. FeatBit MCP lets the
          agent read and update release-decision experiments through FeatBit API.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <GuideSection
          icon={<MessageSquareText className="size-4" />}
          title="Recommended prompt for this step"
        >
          <p>
            Each stage follows the release-decision skill flow. The agent should
            skip any step that is already satisfied and move to the next
            applicable skill.
          </p>
          <div className="mt-3">
            <CodeBlock value={stagePrompt} maxLines={8} />
          </div>
        </GuideSection>

        <GuideSection
          icon={<ShieldCheck className="size-4" />}
          title="1. Create or revoke your MCP token"
        >
          <p>
            The token uses your FeatBit user permissions across this workspace.
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
              <p className="rounded-md border border-border/80 bg-muted/20 px-2 py-1.5 text-xs">
                If an agent reports an authentication or token error, create a
                new MCP token and copy the new Codex start/resume command.
              </p>
              <CodeBlock value={token.access_token} maxLines={3} />
            </div>
          )}
        </GuideSection>

        <GuideSection
          icon={<Terminal className="size-4" />}
          title="2. Prepare the agent token"
        >
          {selectedAgent === "codex" ? (
            <>
              <p>
                For Codex, run the one-time MCP registration in step 3 first,
                then copy one of these commands. The token is pasted directly
                into the command and is only used by the Codex process it
                starts.
              </p>
              <p className="mt-2 rounded-md border border-border/80 bg-muted/20 px-2 py-1.5">
                The Codex MCP registration still refers to
                <code> FEATBIT_MCP_TOKEN</code> internally because the Codex CLI
                does not accept a direct bearer-token argument for
                <code> mcp add</code>.
              </p>
              <div className="mt-3 space-y-3">
                <div className="rounded-md border border-border/80 bg-muted/20 p-2.5">
                  <CommandGroup title="Start fresh Codex with this token">
                    <CodeBlock value={codexStartCommand} maxLines={3} />
                  </CommandGroup>
                </div>
                <div className="rounded-md border border-border/80 bg-muted/20 p-2.5">
                  <CommandGroup title="Resume Codex with this token">
                    <p className="mb-2">
                      Replace <code>&lt;conversation-id&gt;</code> with the
                      resume id printed by Codex.
                    </p>
                    <CodeBlock value={codexResumeCommand} maxLines={3} />
                  </CommandGroup>
                </div>
              </div>
            </>
          ) : (
            <>
              <p>
                Pick the shell where your coding agent runs, then copy the token
                command before starting the agent.
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
          title="3. Register FeatBit MCP for your agent"
        >
          <p>
            Pick your coding agent and copy the matching MCP registration or
            server config.
          </p>
          {selectedAgent === "codex" && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Codex loads MCP servers when a conversation starts, and this
              registration stores only the environment-variable name. Paste the
              token through the Codex start/resume command in step 2, then open
              or resume Codex; the already-running conversation will not see new
              MCP tools.
            </p>
          )}
          <div className="mt-3 space-y-3">
            <SegmentedTabs
              ariaLabel="Coding agent"
              options={agentOptions}
              value={selectedAgent}
              onChange={setSelectedAgent}
            />
            <div className="rounded-md border border-border/80 bg-muted/20 p-2.5">
              <CommandGroup title={selectedAgentOption.commandTitle}>
                <p className="mb-2">{selectedAgentOption.commandHelp}</p>
                <CodeBlock
                  value={selectedAgentOption.commandValue}
                  maxLines={selectedAgentOption.commandMaxLines}
                />
              </CommandGroup>
            </div>
          </div>
        </GuideSection>

        <GuideSection
          icon={<LockKeyhole className="size-4" />}
          title="4. Install or update the skills"
        >
          <p>
            Skills define how the agent should reason about release-decision
            experiments. MCP owns the FeatBit reads and writes.
          </p>
          <div className="mt-3 space-y-2">
            <CodeBlock value={skillInstallCommand} />
            <CodeBlock value={skillUpdateCommand} />
          </div>
        </GuideSection>

        <GuideSection
          icon={<MessageSquareText className="size-4" />}
          title="5. Start with experiment context"
        >
          <p>
            Copy the starter text for the selected coding agent when you want
            it to inspect the current experiment, analyze evidence, update the
            experiment record, or recommend the next decision.
          </p>
          {selectedAgent === "codex" && (
            <p className="mt-2 rounded-md border border-border/80 bg-muted/20 px-2 py-1.5">
              Paste this into a Codex conversation that was started or resumed
              after the FeatBit MCP server was registered.
            </p>
          )}
          <div className="mt-3 space-y-2">
            <CodeBlock value={agentStartValue} maxLines={5} />
          </div>
        </GuideSection>

        <GuideSection
          icon={<ClipboardList className="size-4" />}
          title="Expected workflow"
        >
          <ul className="list-disc space-y-1 pl-4">
            <li>The coding agent loads the release-decision skill instructions.</li>
            <li>The agent calls FeatBit MCP tools with this experiment id.</li>
            <li>FeatBit API resolves the environment and checks your permissions.</li>
            <li>The agent updates hypothesis, metrics, runs, analysis, or learnings through FeatBit API.</li>
            <li>Refresh this page to see changes made by the agent.</li>
          </ul>
        </GuideSection>
      </div>
    </aside>
  );
}

function buildStagePrompt(activeStage: string, experimentId: string) {
  const prefix = [
    `Use the $featbit-release-decision skill for experiment ${experimentId}.`,
    "Read the experiment through FeatBit MCP before changing anything.",
    "If the current step is already satisfied, say what evidence shows that and skip to the next applicable release-decision skill.",
  ];

  switch (activeStage) {
    case "hypothesis":
      return [
        ...prefix,
        "Run intent-shaping and hypothesis-design. Clarify the business outcome, intent, change, audience, and falsifiable hypothesis.",
        "Persist the updated goal, intent, hypothesis, change, constraints, and stage through FeatBit MCP.",
      ].join("\n");
    case "implementing":
      return [
        ...prefix,
        "Run reversible-exposure-control. Configure or verify the FeatBit managed feature flag, rollout/audience strategy, and variant mapping from the actual flag.",
        "Do not ask me to manually type variants or observed data. Use FeatBit flag configuration and metric events as the source of truth.",
      ].join("\n");
    case "measuring":
      return [
        ...prefix,
        "Run measurement-design, then experiment-workspace or evidence-analysis as appropriate.",
        "Use FeatBit managed flag evaluation and metric event data through FeatBit API. Do not ask me to paste per-variant data. Third-party API evidence is not supported yet; note the gap instead of inventing a fetch path.",
      ].join("\n");
    case "learning":
      return [
        ...prefix,
        "Run learning-capture. Summarize what changed, what happened, whether the hypothesis was confirmed or refuted, why it likely happened, and the next hypothesis.",
        "Persist the learning through FeatBit MCP.",
      ].join("\n");
    default:
      return [
        ...prefix,
        "Inspect the current experiment state and recommend the next smallest release-decision step.",
      ].join("\n");
  }
}

function GuideSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
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
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 space-y-2">
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
