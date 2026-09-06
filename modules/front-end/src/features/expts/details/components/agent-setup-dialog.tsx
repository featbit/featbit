import { Check, ChevronRight, Copy, KeyRound, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import {
  getStoredUserProfile,
  onSessionExpired,
} from "@/features/auth/auth-api"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
  onCurrentOrganizationChanged,
} from "@/features/layout/layout-context"
import {
  createExperimentMcpToken,
  revokeExperimentMcpToken,
} from "../experiment-details-api"
import type {
  ExperimentDetail,
  StoredMcpToken,
} from "../experiment-details-types"
import {
  getMatchingMcpTokenExpiry,
  getStoredMcpTokenSnapshot,
  MCP_TOKEN_CHANGED_EVENT,
  migrateStoredMcpToken,
  readStoredMcpToken,
  storeMcpToken,
  type McpTokenContext,
} from "../mcp-token-storage"

function subscribeTokenStorage(onChange: () => void) {
  const unsubscribeOrganization = onCurrentOrganizationChanged(onChange)
  const unsubscribeSession = onSessionExpired(onChange)
  window.addEventListener("storage", onChange)
  window.addEventListener(MCP_TOKEN_CHANGED_EVENT, onChange)
  return () => {
    unsubscribeOrganization()
    unsubscribeSession()
    window.removeEventListener("storage", onChange)
    window.removeEventListener(MCP_TOKEN_CHANGED_EVENT, onChange)
  }
}

function tokenContextSnapshot() {
  const userId = getStoredUserProfile().id
  const organizationId = getCurrentOrganization()?.id
  const workspaceId = getCurrentWorkspace()?.id
  if (!userId || !organizationId || !workspaceId) return ""

  return JSON.stringify({
    apiUrl: new URL(getRuntimeEnv().apiUrl.trim(), window.location.origin).href,
    userId,
    organizationId,
    workspaceId,
  } satisfies McpTokenContext)
}

function CopyButton({
  value,
  label,
  variant = "outline",
  disabled = false,
}: {
  value: string
  label?: string
  variant?: "default" | "outline"
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className="shrink-0"
      disabled={disabled}
      onClick={() => void copy()}
    >
      {copied ? <Check /> : <Copy />}
      {copied
        ? t("releaseDecision.experiments.detailsPage.copied")
        : (label ?? t("releaseDecision.experiments.detailsPage.copy"))}
    </Button>
  )
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-5 break-all whitespace-pre-wrap text-foreground">
        {value}
      </code>
      <CopyButton value={value} />
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
    <section className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 p-4 sm:px-5">
      <span className="flex size-7 items-center justify-center rounded-full border text-xs font-medium">
        {number}
      </span>
      <div className="min-w-0 space-y-2.5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm leading-5 text-muted-foreground">{helper}</p>
        </div>
        {children}
      </div>
    </section>
  )
}

type AgentSetupDialogProps = {
  open: boolean
  experiment: ExperimentDetail
  onOpenChange: (open: boolean) => void
}

export function AgentSetupDialog(props: AgentSetupDialogProps) {
  const snapshot = useSyncExternalStore(
    subscribeTokenStorage,
    tokenContextSnapshot
  )
  const context = useMemo(
    () => (snapshot ? (JSON.parse(snapshot) as McpTokenContext) : null),
    [snapshot]
  )

  return <AgentSetupContent key={snapshot} context={context} {...props} />
}

function AgentSetupContent({
  open,
  experiment,
  onOpenChange,
  context,
}: AgentSetupDialogProps & { context: McpTokenContext | null }) {
  const { t, i18n } = useTranslation()
  const snapshot = useSyncExternalStore(subscribeTokenStorage, () =>
    context ? getStoredMcpTokenSnapshot(context) : null
  )
  const token = useMemo(
    () => (context && snapshot ? readStoredMcpToken(context) : null),
    [context, snapshot]
  )
  const [referenceTime, setReferenceTime] = useState(() => Date.now())
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (context) migrateStoredMcpToken(context)
  }, [context])

  useEffect(() => {
    if (!token) return
    const expiresAt = new Date(token.expires_at).getTime()
    if (expiresAt <= referenceTime) return
    const timeout = window.setTimeout(
      () => setReferenceTime(Date.now()),
      Math.max(0, Math.min(expiresAt - Date.now(), 2_147_483_647))
    )
    return () => window.clearTimeout(timeout)
  }, [token, referenceTime])

  const tokenExpired = token
    ? new Date(token.expires_at).getTime() <= referenceTime
    : false
  const tokenReady = !!token?.access_token && !tokenExpired
  const tokenValue = tokenReady ? token.access_token : "<create-token-first>"
  const maskedToken = tokenReady ? "••••••••••••••••" : tokenValue
  const runtimeEnv = getRuntimeEnv()
  const apiUrl = runtimeEnv.displayApiUrl.trim() || runtimeEnv.apiUrl.trim()
  const mcpUrl = new URL(
    `${apiUrl.replace(/\/+$/, "")}/mcp`,
    window.location.origin
  ).href

  function setupPrompt(accessToken: string) {
    return t("releaseDecision.experiments.detailsPage.agentSetup.setupPrompt", {
      url: mcpUrl,
      token: accessToken,
      experimentId: experiment.id,
    })
  }

  async function createToken() {
    if (!experiment.featBitEnvId || !context) return
    setCreating(true)
    setError(false)
    try {
      const response = await createExperimentMcpToken(experiment.featBitEnvId)
      const createdAt = new Date()
      const stored: StoredMcpToken = {
        ...response,
        expires_at: new Date(
          createdAt.getTime() + response.expires_in * 1000
        ).toISOString(),
      }
      // Authentication may have changed while an API request was retried.
      const expiresAt = getMatchingMcpTokenExpiry(stored, context)
      if (expiresAt === null) throw new Error("MCP token context mismatch")
      storeMcpToken(context, {
        ...stored,
        expires_at: new Date(expiresAt).toISOString(),
      })
    } catch {
      setError(true)
    } finally {
      setCreating(false)
    }
  }

  async function revokeToken() {
    if (!token?.access_token || !context) return
    setRevoking(true)
    setError(false)
    try {
      await revokeExperimentMcpToken(token.access_token)
      if (readStoredMcpToken(context)?.access_token === token.access_token) {
        storeMcpToken(context, null)
      }
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
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle className="text-lg">
            {t("releaseDecision.experiments.detailsPage.agentSetup.title")}
          </DialogTitle>
          <DialogDescription>
            {t("releaseDecision.experiments.detailsPage.agentSetup.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain p-4">
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`size-2 shrink-0 rounded-full ${
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
                            expires: formatDate(token.expires_at),
                          }
                        )
                    : t(
                        "releaseDecision.experiments.detailsPage.agentSetup.noToken"
                      )}
                </div>
                <div className="flex items-center gap-1.5">
                  {token ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={creating || revoking}
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
                    variant={tokenReady ? "outline" : "default"}
                    size="sm"
                    disabled={
                      creating ||
                      revoking ||
                      !experiment.featBitEnvId ||
                      !context
                    }
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
              {!context ? (
                <p className="text-sm text-destructive">
                  {t(
                    "releaseDecision.experiments.detailsPage.agentSetup.contextMissing"
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

              <div className="overflow-hidden rounded-lg border bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {t(
                        "releaseDecision.experiments.detailsPage.agentSetup.promptTitle"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "releaseDecision.experiments.detailsPage.agentSetup.promptHelp"
                      )}
                    </p>
                  </div>
                  <CopyButton
                    value={setupPrompt(tokenValue)}
                    label={t(
                      "releaseDecision.experiments.detailsPage.agentSetup.copyPrompt"
                    )}
                    variant="default"
                    disabled={
                      !tokenReady ||
                      creating ||
                      revoking ||
                      !experiment.featBitEnvId ||
                      !context
                    }
                  />
                </div>
                <details className="group border-t">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                    {t(
                      "releaseDecision.experiments.detailsPage.agentSetup.previewPrompt"
                    )}
                  </summary>
                  <pre className="max-h-48 overflow-auto border-t px-3 py-2 font-mono text-xs leading-5 break-words whitespace-pre-wrap">
                    {setupPrompt(maskedToken)}
                  </pre>
                </details>
              </div>
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
