"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ClipboardList,
  Copy,
  KeyRound,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, FeatBitApiError } from "@/lib/featbit-auth/http";
import { cn } from "@/lib/utils";
import type { Experiment, ExperimentRun } from "@/lib/release-decision-types";

const MCP_TOKEN_STORAGE_KEY = "featbit:mcp-token:last";

type ExperimentWithRuns = Experiment & {
  experimentRuns: ExperimentRun[];
};

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

export function CodingAgentSetupDialogContent({
  experiment,
}: {
  experiment: ExperimentWithRuns;
}) {
  const envId = experiment.featbitEnvId;
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

  const tokenValue = token?.access_token ?? "<create-token-first>";
  const powerShellToken = quotePowerShell(tokenValue);
  const shellToken = quotePosixShell(tokenValue);
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
  const skillInstallCommand = "npx skills add featbit/featbit-release-decision-skills";
  const skillUpdateCommand = "npx skills update featbit/featbit-release-decision-skills";
  const tokenLifetimeLabel = token ? formatDuration(token.expires_in) : null;
  const tokenExpired = token ? new Date(token.expires_at).getTime() <= Date.now() : false;

  const shellOptions: ShellOption[] = [
    {
      id: "powershell",
      label: "PowerShell",
      description:
        "FEATBIT_MCP_TOKEN is the environment variable that stores the token created above.",
      command: `$env:FEATBIT_MCP_TOKEN="${powerShellToken}"`,
    },
    {
      id: "bash",
      label: "bash",
      description:
        "FEATBIT_MCP_TOKEN is the environment variable that stores the token created above.",
      command: `export FEATBIT_MCP_TOKEN='${shellToken}'`,
    },
    {
      id: "zsh",
      label: "zsh",
      description:
        "FEATBIT_MCP_TOKEN is the environment variable that stores the token created above.",
      command: `export FEATBIT_MCP_TOKEN='${shellToken}'`,
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
        "Run once. Codex stores the MCP URL and reads the bearer token from FEATBIT_MCP_TOKEN.",
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

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-primary/25 bg-primary/[0.035] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <div className="font-semibold text-foreground">Before you start</div>
        <ul className="mt-1.5 space-y-1">
          <li className="flex gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Use Codex, Claude Code, Copilot CLI, OpenCode, or another
            MCP-capable coding agent.
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Install the FeatBit release-decision skill at the user or project
            level.
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Connect the FeatBit MCP server. It runs on the same port as the API:
            <code className="font-mono text-foreground">http://localhost:5000/mcp</code>.
          </li>
        </ul>
      </div>

      <SetupSection
        icon={<ClipboardList className="size-4" />}
        title="1. Install release-decision skills"
      >
        <p>
          Install once at the user or project level, then update when the skill
          package changes.
        </p>
        <div className="mt-3 space-y-2">
          <CodeBlock value={skillInstallCommand} />
          <CodeBlock value={skillUpdateCommand} />
        </div>
      </SetupSection>

      <SetupSection
        icon={<LockKeyhole className="size-4" />}
        title="2. Connect FeatBit MCP"
      >
        <p>
          Create a scoped token, then register the MCP server in your coding
          agent. <code>FEATBIT_MCP_TOKEN</code> is the shell variable that holds
          the token created here.
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

        <div className="mt-4 space-y-3">
          <CommandGroup title="Set the MCP token environment variable">
            <SegmentedTabs
              ariaLabel="Shell"
              options={shellOptions.map(({ id, label }) => ({ id, label }))}
              value={selectedShell}
              onChange={setSelectedShell}
            />
            <p className="mb-2 mt-2">{selectedShellOption.description}</p>
            <CodeBlock
              value={selectedShellOption.command}
              maxLines={selectedShellOption.maxLines}
            />
          </CommandGroup>
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
      </SetupSection>
    </div>
  );
}

function SetupSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border/80 bg-background/75 p-3">
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
    <div className="mt-3 space-y-2 rounded-md border border-border/80 bg-muted/20 p-2.5">
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
