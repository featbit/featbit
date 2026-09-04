import { Check, ChevronRight, Copy, KeyRound, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createExperimentMcpToken,
  revokeExperimentMcpToken,
} from "../experiment-details-api"
import type {
  ExperimentDetail,
  StoredMcpToken,
} from "../experiment-details-types"

type AgentId = "codex" | "claude" | "opencode" | "copilot" | "generic"

const AGENTS: AgentId[] = ["codex", "claude", "opencode", "copilot", "generic"]

function storageKey(experiment: ExperimentDetail) {
  return `featbit:mcp-token:${experiment.featBitEnvId ?? "unbound"}:${experiment.id}`
}

function quoteJson(value: string) {
  return JSON.stringify(value).slice(1, -1)
}

function quoteToml(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function readStoredToken(key: string) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as StoredMcpToken) : null
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function CodeBlock({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-5 break-all whitespace-pre-wrap text-foreground">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => void copy()}
      >
        {copied ? <Check /> : <Copy />}
        {t(
          copied
            ? "releaseDecision.experiments.detailsPage.copied"
            : "releaseDecision.experiments.detailsPage.copy"
        )}
      </Button>
    </div>
  )
}

function Step({
  number,
  title,
  helper,
  children,
}: {
  number: number
  title: string
  helper: string
  children: React.ReactNode
}) {
  return (
    <section className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 px-5 py-5">
      <span className="flex size-7 items-center justify-center rounded-full border text-xs font-medium">
        {number}
      </span>
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm leading-5 text-muted-foreground">{helper}</p>
        </div>
        {children}
      </div>
    </section>
  )
}

export function AgentSetupDialog({
  open,
  experiment,
  onOpenChange,
}: {
  open: boolean
  experiment: ExperimentDetail
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const key = storageKey(experiment)
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("codex")
  const [token, setToken] = useState<StoredMcpToken | null>(() =>
    readStoredToken(key)
  )
  const [referenceTime] = useState(() => Date.now())
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState(false)

  const tokenExpired = token
    ? new Date(token.expires_at).getTime() <= referenceTime
    : false
  const tokenValue = tokenExpired
    ? "<create-token-first>"
    : (token?.access_token ?? "<create-token-first>")
  const genericConfig = `{
  "mcpServers": {
    "featbit-experimentation": {
      "type": "http",
      "url": "http://localhost:5000/mcp",
      "headers": {
        "Authorization": "Bearer ${quoteJson(tokenValue)}"
      }
    }
  }
}`
  const selectedLabel = t(
    `releaseDecision.experiments.detailsPage.agentSetup.agents.${selectedAgent}`
  )
  const selectedConfig = useMemo(
    () =>
      selectedAgent === "codex"
        ? null
        : {
            title: t(
              "releaseDecision.experiments.detailsPage.agentSetup.httpConfig",
              { agent: selectedLabel }
            ),
            helper: t(
              "releaseDecision.experiments.detailsPage.agentSetup.httpConfigHelp",
              { agent: selectedLabel }
            ),
            value: genericConfig,
          },
    [genericConfig, selectedAgent, selectedLabel, t]
  )

  async function createToken() {
    if (!experiment.featBitEnvId) return
    setCreating(true)
    setError(false)
    try {
      const response = await createExperimentMcpToken(
        experiment.featBitEnvId,
        experiment.id
      )
      const createdAt = new Date()
      const stored: StoredMcpToken = {
        ...response,
        created_at: createdAt.toISOString(),
        expires_at: new Date(
          createdAt.getTime() + response.expires_in * 1000
        ).toISOString(),
      }
      localStorage.setItem(key, JSON.stringify(stored))
      setToken(stored)
    } catch {
      setError(true)
    } finally {
      setCreating(false)
    }
  }

  async function revokeToken() {
    if (!token?.access_token) return
    setRevoking(true)
    setError(false)
    try {
      await revokeExperimentMcpToken(token.access_token)
      localStorage.removeItem(key)
      setToken(null)
    } catch {
      setError(true)
    } finally {
      setRevoking(false)
    }
  }

  const locale = i18n.resolvedLanguage === "zh" ? "zh-CN" : "en"
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!creating && !revoking) onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[88dvh] sm:max-w-[940px]"
        showCloseButton={!creating && !revoking}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle className="text-lg">
            {t("releaseDecision.experiments.detailsPage.agentSetup.title")}
          </DialogTitle>
          <DialogDescription>
            {t("releaseDecision.experiments.detailsPage.agentSetup.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain p-5">
          <div className="divide-y overflow-hidden rounded-lg border">
            <Step
              number={1}
              title={t(
                "releaseDecision.experiments.detailsPage.agentSetup.installTitle"
              )}
              helper={t(
                "releaseDecision.experiments.detailsPage.agentSetup.installHelp"
              )}
            >
              <CodeBlock value="npx skills add featbit/featbit-skills --skill featbit-experimentation" />
            </Step>

            <Step
              number={2}
              title={t(
                "releaseDecision.experiments.detailsPage.agentSetup.connectTitle"
              )}
              helper={t(
                "releaseDecision.experiments.detailsPage.agentSetup.connectHelp"
              )}
            >
              <Tabs
                value={selectedAgent}
                onValueChange={(value) => setSelectedAgent(value as AgentId)}
              >
                <TabsList className="h-9 max-w-full overflow-x-auto overflow-y-hidden rounded-lg border bg-background p-0">
                  {AGENTS.map((agent) => (
                    <TabsTrigger
                      key={agent}
                      value={agent}
                      className="h-8 rounded-none border-r px-4 first:rounded-l-lg last:rounded-r-lg last:border-r-0 data-active:bg-primary data-active:text-primary-foreground"
                    >
                      {t(
                        `releaseDecision.experiments.detailsPage.agentSetup.agents.${agent}`
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className={`size-2 rounded-full ${
                      token && !tokenExpired
                        ? "bg-emerald-500"
                        : tokenExpired
                          ? "bg-amber-500"
                          : "bg-muted-foreground/40"
                    }`}
                  />
                  {token
                    ? tokenExpired
                      ? t(
                          "releaseDecision.experiments.detailsPage.agentSetup.tokenExpired"
                        )
                      : t(
                          "releaseDecision.experiments.detailsPage.agentSetup.tokenCreated",
                          {
                            created: formatDate(token.created_at),
                            expires: formatDate(token.expires_at),
                          }
                        )
                    : t(
                        "releaseDecision.experiments.detailsPage.agentSetup.noToken"
                      )}
                </div>
                <div className="flex items-center gap-2">
                  {token ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={revoking}
                      onClick={() => void revokeToken()}
                    >
                      {revoking ? <Loader2 className="animate-spin" /> : null}
                      {t(
                        revoking
                          ? "releaseDecision.experiments.detailsPage.agentSetup.revoking"
                          : "releaseDecision.experiments.detailsPage.agentSetup.revokeToken"
                      )}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    disabled={creating || !experiment.featBitEnvId}
                    onClick={() => void createToken()}
                  >
                    {creating ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <KeyRound />
                    )}
                    {t(
                      creating
                        ? "releaseDecision.experiments.detailsPage.agentSetup.creating"
                        : "releaseDecision.experiments.detailsPage.agentSetup.createToken"
                    )}
                  </Button>
                </div>
              </div>

              {!experiment.featBitEnvId ? (
                <p className="text-sm text-destructive">
                  {t(
                    "releaseDecision.experiments.detailsPage.agentSetup.bindEnvironment"
                  )}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {t(
                    "releaseDecision.experiments.detailsPage.agentSetup.tokenFailed"
                  )}
                </p>
              ) : null}

              {selectedAgent === "codex" ? (
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">
                      {t(
                        "releaseDecision.experiments.detailsPage.agentSetup.codexRegistration"
                      )}
                    </h4>
                    <CodeBlock value="codex mcp add featbit-experimentation --url http://localhost:5000/mcp" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">
                      {t(
                        "releaseDecision.experiments.detailsPage.agentSetup.authorizationHeader"
                      )}
                    </h4>
                    <CodeBlock
                      value={`[mcp_servers.featbit-experimentation]\nurl = "http://localhost:5000/mcp"\nhttp_headers = { "Authorization" = "Bearer ${quoteToml(tokenValue)}" }`}
                    />
                  </div>
                  <details className="group rounded-lg border bg-background">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
                      <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                      {t(
                        "releaseDecision.experiments.detailsPage.agentSetup.openCodexConfig"
                      )}
                    </summary>
                    <div className="border-t p-3">
                      <CodeBlock
                        value={`# Windows PowerShell\nNew-Item -ItemType Directory -Force "$env:USERPROFILE\\.codex" | Out-Null\nnotepad "$env:USERPROFILE\\.codex\\config.toml"\n\n# macOS / Linux\nmkdir -p ~/.codex && \${EDITOR:-vi} ~/.codex/config.toml`}
                      />
                    </div>
                  </details>
                </div>
              ) : selectedConfig ? (
                <div className="space-y-2 pt-1">
                  <h4 className="text-sm font-medium">
                    {selectedConfig.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedConfig.helper}
                  </p>
                  <CodeBlock value={selectedConfig.value} />
                </div>
              ) : null}
            </Step>

            <Step
              number={3}
              title={t(
                "releaseDecision.experiments.detailsPage.agentSetup.startTitle"
              )}
              helper={t(
                "releaseDecision.experiments.detailsPage.agentSetup.startHelp"
              )}
            >
              <CodeBlock value={`@featbit-experimentation ${experiment.id}`} />
            </Step>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
