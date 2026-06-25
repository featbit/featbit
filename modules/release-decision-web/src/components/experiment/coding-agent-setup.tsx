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

type AgentId = "codex" | "claude" | "opencode" | "copilot" | "generic";

type TabOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
};

type AgentOption = TabOption<AgentId> & {
  commandTitle: string;
  commandHelp: string;
  commandValue: string;
  secondaryCommandTitle?: string;
  secondaryCommandHelp?: string;
  secondaryCommandValue?: string;
  tertiaryCommandTitle?: string;
  tertiaryCommandHelp?: string;
  tertiaryCommandValue?: string;
  commandMaxLines?: number;
  secondaryCommandMaxLines?: number;
  tertiaryCommandMaxLines?: number;
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
  const codexCliCommand =
    "codex mcp add featbit-experimentation --url http://localhost:5000/mcp";
  const codexMcpConfig = `[mcp_servers.featbit-experimentation]
url = "http://localhost:5000/mcp"
http_headers = { "Authorization" = "Bearer ${quoteTomlString(tokenValue)}" }`;
  const codexOpenConfigCommand = `# Windows PowerShell
New-Item -ItemType Directory -Force "$env:USERPROFILE\\.codex" | Out-Null
notepad "$env:USERPROFILE\\.codex\\config.toml"

# macOS / Linux
mkdir -p ~/.codex && ${"$"}{EDITOR:-vi} ~/.codex/config.toml`;
  const genericMcpConfig = `{
  "mcpServers": {
    "featbit-experimentation": {
      "type": "http",
      "url": "http://localhost:5000/mcp",
      "headers": {
        "Authorization": "Bearer ${quoteJsonStringContent(tokenValue)}"
      }
    }
  }
}`;
  const skillInstallCommand =
    "npx skills add featbit/featbit-release-decision-skills --skill featbit-experimentation";
  const startUsingPrompt = `@featbit-experimentation-skills ${experiment.id}

Use the FeatBit experimentation MCP tools to inspect this experiment, continue the current release-decision workflow, and suggest the next evidence-backed action.`;
  const tokenLifetimeLabel = token ? formatDuration(token.expires_in) : null;
  const tokenExpired = token ? new Date(token.expires_at).getTime() <= Date.now() : false;

  const agentOptions: AgentOption[] = [
    {
      id: "codex",
      label: "Codex",
      description: "Use your current Codex conversation.",
      commandTitle: "Codex MCP registration",
      commandHelp:
        "Configure the MCP server with the Codex CLI.",
      commandValue: codexCliCommand,
      commandMaxLines: 4,
      secondaryCommandTitle: "Codex token config",
      secondaryCommandHelp:
        "After running the CLI command, add this static Authorization header to your Codex config. Default path: ~/.codex/config.toml on macOS/Linux, or %USERPROFILE%\\.codex\\config.toml on Windows. You can also use .codex/config.toml in this trusted project.",
      secondaryCommandValue: codexMcpConfig,
      secondaryCommandMaxLines: 4,
      tertiaryCommandTitle: "Open Codex config",
      tertiaryCommandHelp: "Use one of these commands to open or create the global Codex config file.",
      tertiaryCommandValue: codexOpenConfigCommand,
      tertiaryCommandMaxLines: 8,
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
      commandHelp: "Use this HTTP MCP server config in any compatible agent.",
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
        </ul>
      </div>

      <SetupSection
        icon={<ClipboardList className="size-4" />}
        title="1. Install release-decision skills"
      >
        <p>
          Install the FeatBit experimentation skill once at the user or project
          level.
        </p>
        <div className="mt-3 space-y-2">
          <CodeBlock value={skillInstallCommand} />
        </div>
      </SetupSection>

      <SetupSection
        icon={<LockKeyhole className="size-4" />}
        title="2. Connect FeatBit MCP"
      >
        <p>
          Create a scoped token, then register the MCP server in your coding
          agent. The registration snippets below include the token created here.
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
          </div>
        )}

        <div className="mt-4 space-y-3">
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
          {selectedAgentOption.secondaryCommandValue && (
            <CommandGroup title={selectedAgentOption.secondaryCommandTitle ?? "Additional config"}>
              {selectedAgentOption.secondaryCommandHelp && (
                <p className="mb-2">{selectedAgentOption.secondaryCommandHelp}</p>
              )}
              <CodeBlock
                value={selectedAgentOption.secondaryCommandValue}
                maxLines={selectedAgentOption.secondaryCommandMaxLines}
              />
            </CommandGroup>
          )}
          {selectedAgentOption.tertiaryCommandValue && (
            <CommandGroup title={selectedAgentOption.tertiaryCommandTitle ?? "Open config"}>
              {selectedAgentOption.tertiaryCommandHelp && (
                <p className="mb-2">{selectedAgentOption.tertiaryCommandHelp}</p>
              )}
              <CodeBlock
                value={selectedAgentOption.tertiaryCommandValue}
                maxLines={selectedAgentOption.tertiaryCommandMaxLines}
              />
            </CommandGroup>
          )}
        </div>
      </SetupSection>

      <SetupSection
        icon={<Check className="size-4" />}
        title="3. Start using it"
      >
        <p>
          After the skill and MCP server are configured, paste this into your
          coding agent to start working with this experiment.
        </p>
        <div className="mt-3">
          <CodeBlock value={startUsingPrompt} maxLines={5} />
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

function quoteJsonStringContent(value: string) {
  return JSON.stringify(value).slice(1, -1);
}

function quoteTomlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
