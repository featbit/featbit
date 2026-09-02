import {
  Activity,
  CheckCircle2,
  Clock3,
  CloudCog,
  Database,
  Info,
  Play,
  Radar,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { MetricSourceConnection } from "../release-health-types"
import {
  connectionForEditor,
  prometheusConnectionWrite,
  releaseHealthApi,
  type ReleaseHealthScope,
} from "../release-health-api"
import { SourceConnectionProviderFields } from "./source-connection-provider-fields"
import {
  emptySourceConnectionConfiguration,
  isValidHttpUrl,
  type SourceConnectionConfigurationDraft,
  type SourceConnectionProviderType,
} from "./source-connection-provider-types"

const providerOptions = [
  { type: "prometheus-compatible", icon: Activity, available: true },
  { type: "datadog", icon: CloudCog, available: false },
  { type: "new-relic", icon: Radar, available: false },
  { type: "azure-data-explorer", icon: Database, available: false },
] as const satisfies ReadonlyArray<{
  type: SourceConnectionProviderType
  icon: typeof Activity
  available: boolean
}>

type SourceConnectionSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  environmentKey: string
  environmentName: string
  connection?: MetricSourceConnection
  onSaved?: (connection: MetricSourceConnection) => void
  liveScope?: ReleaseHealthScope
}

export function SourceConnectionSheet(props: SourceConnectionSheetProps) {
  const editorKey = `${props.connection?.id ?? "new"}:${props.open}`
  return <SourceConnectionSheetEditor key={editorKey} {...props} />
}

function SourceConnectionSheetEditor({
  open,
  onOpenChange,
  environmentKey,
  environmentName,
  connection,
  onSaved,
  liveScope,
}: SourceConnectionSheetProps) {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<SourceConnectionProviderType>(
    connection?.providerType ?? "prometheus-compatible"
  )
  const [name, setName] = useState(connection?.name ?? "")
  const [configuration, setConfiguration] =
    useState<SourceConnectionConfigurationDraft>(() => ({
      ...emptySourceConnectionConfiguration,
      endpoint: connection?.endpoint ?? "",
      authentication: connection?.authentication.type ?? "bearer_token",
      prometheusBasicUsername:
        connection?.authentication.type === "basic"
          ? connection.authentication.username
          : "",
    }))
  const [tested, setTested] = useState(connection?.status === "connected")
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")

  const available = provider === "prometheus-compatible"
  const canKeepConfiguredSecret = Boolean(
    connection &&
    connection.authentication.secretState === "configured" &&
    configuration.authentication === connection.authentication.type
  )
  const credentialsValid =
    configuration.authentication === "none"
      ? true
      : configuration.authentication === "bearer_token"
        ? configuration.prometheusBearerToken.trim().length > 0 ||
          canKeepConfiguredSecret
        : configuration.prometheusBasicUsername.trim().length > 0 &&
          (configuration.prometheusBasicPassword.trim().length > 0 ||
            canKeepConfiguredSecret)
  const valid =
    available &&
    name.trim().length > 0 &&
    isValidHttpUrl(configuration.endpoint) &&
    credentialsValid
  const providerName = t(
    `releaseHealth.connections.editor.providers.${provider}.name`
  )
  const queryLanguage = t(
    `releaseHealth.connections.editor.providers.${provider}.queryLanguage`
  )

  function updateConfiguration(
    next: Partial<SourceConnectionConfigurationDraft>
  ) {
    if (busy) return
    setConfiguration((current) => ({ ...current, ...next }))
    setTested(false)
  }

  function changeName(next: string) {
    if (busy) return
    setName(next)
    setTested(false)
  }

  function changeProvider(next: SourceConnectionProviderType) {
    if (busy) return
    setProvider(next)
    setTested(false)
  }

  async function testConnection() {
    if (!valid) return
    if (liveScope) {
      setBusy(true)
      setTested(false)
      setFailure("")
      try {
        await releaseHealthApi.test(
          liveScope,
          prometheusConnectionWrite(
            name,
            configuration,
            connection?.backendVersion
          ),
          connection?.id
        )
        setTested(true)
        toast.success(t("releaseHealth.live.testPassed"))
      } catch {
        setFailure(t("releaseHealth.live.connectionFailed"))
      } finally {
        setBusy(false)
      }
      return
    }
    setTested(true)
    toast.success(t("releaseHealth.connections.editor.testPassed"))
  }

  async function save() {
    if (!available || !tested || !valid) return
    if (liveScope) {
      setBusy(true)
      setFailure("")
      try {
        const saved = await releaseHealthApi.save(
          liveScope,
          prometheusConnectionWrite(
            name,
            configuration,
            connection?.backendVersion
          ),
          connection?.id
        )
        onSaved?.(connectionForEditor(saved, environmentKey))
        toast.success(t("releaseHealth.live.saved"))
        onOpenChange(false)
      } catch {
        setFailure(t("releaseHealth.live.connectionFailed"))
        setTested(false)
      } finally {
        setBusy(false)
      }
      return
    }
    const authentication: MetricSourceConnection["authentication"] =
      configuration.authentication === "none"
        ? { type: "none", secretState: "not_configured" }
        : configuration.authentication === "bearer_token"
          ? {
              type: "bearer_token",
              secretState: "configured",
              lastRotatedAt:
                configuration.prometheusBearerToken.trim().length > 0
                  ? t("releaseHealth.connections.justNow")
                  : connection?.authentication.type === "bearer_token"
                    ? connection.authentication.lastRotatedAt
                    : t("releaseHealth.connections.justNow"),
            }
          : {
              type: "basic",
              username: configuration.prometheusBasicUsername.trim(),
              secretState: "configured",
              lastRotatedAt:
                configuration.prometheusBasicPassword.trim().length > 0
                  ? t("releaseHealth.connections.justNow")
                  : connection?.authentication.type === "basic"
                    ? connection.authentication.lastRotatedAt
                    : t("releaseHealth.connections.justNow"),
            }
    const configurationChanged = Boolean(
      connection &&
      (connection.endpoint.trim() !== configuration.endpoint.trim() ||
        connection.authentication.type !== configuration.authentication ||
        (configuration.authentication === "basic" &&
          (connection.authentication.type !== "basic" ||
            connection.authentication.username !==
              configuration.prometheusBasicUsername.trim())))
    )
    const revision = connection
      ? connection.revision + (configurationChanged ? 1 : 0)
      : 1
    const saved: MetricSourceConnection = {
      id: connection?.id ?? `connection-${slug(name)}`,
      environmentKey,
      providerType: "prometheus-compatible",
      name: name.trim(),
      endpoint: configuration.endpoint.trim(),
      authentication,
      revision,
      status: "connected",
      lastCheckedAt: t("releaseHealth.connections.justNow"),
      usedByBindings: connection?.usedByBindings ?? 0,
    }
    onSaved?.(saved)
    toast.success(
      t(
        connection
          ? "releaseHealth.connections.editor.updated"
          : "releaseHealth.connections.editor.created"
      )
    )
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-[calc(100%-1rem)] data-[side=right]:sm:max-w-[840px]">
        <SheetHeader className="border-b px-4 py-5 pr-12 sm:px-6">
          <SheetTitle>
            {t(
              connection
                ? "releaseHealth.connections.editor.editTitle"
                : "releaseHealth.connections.editor.title"
            )}
          </SheetTitle>
          <SheetDescription>
            {t("releaseHealth.connections.editor.description", {
              provider: providerName,
              environment: environmentName,
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}
          <Alert>
            <Info />
            <AlertDescription>
              {t("releaseHealth.connections.editor.scopeNotice", {
                environment: environmentName,
                queryLanguage,
              })}
            </AlertDescription>
          </Alert>

          <ProviderSelector provider={provider} onChange={changeProvider} />

          {!available ? (
            <Alert className="border-dashed bg-muted/20">
              <Clock3 />
              <AlertTitle>
                {t("releaseHealth.connections.editor.previewOnlyTitle", {
                  provider: providerName,
                })}
              </AlertTitle>
              <AlertDescription>
                {t("releaseHealth.connections.editor.previewOnlyDescription", {
                  queryLanguage,
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="source-connection-name">
              {t("releaseHealth.connections.name")}
            </Label>
            <Input
              id="source-connection-name"
              value={name}
              onChange={(event) => changeName(event.target.value)}
              placeholder={t(
                `releaseHealth.connections.editor.providers.${provider}.namePlaceholder`
              )}
            />
          </div>

          <div className="space-y-4 rounded-lg border p-4 sm:p-5">
            <div>
              <p className="text-sm font-medium">
                {t("releaseHealth.connections.editor.providerConfiguration", {
                  provider: providerName,
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  `releaseHealth.connections.editor.providers.${provider}.configurationHelp`
                )}
              </p>
            </div>
            <SourceConnectionProviderFields
              provider={provider}
              draft={configuration}
              connection={connection}
              onChange={updateConfiguration}
            />
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {!available
                    ? t("releaseHealth.connections.editor.adapterRequired")
                    : tested
                      ? t("releaseHealth.connections.editor.connected")
                      : t("releaseHealth.connections.editor.testRequired")}
                </p>
                <p className="mt-1 max-w-lg text-xs text-muted-foreground">
                  {available
                    ? t("releaseHealth.connections.editor.testHelp")
                    : t("releaseHealth.connections.editor.previewTestHelp")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!valid || busy}
                onClick={testConnection}
              >
                {tested ? <CheckCircle2 /> : available ? <Play /> : <Clock3 />}
                {t("releaseHealth.connections.test")}
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-end border-t px-4 py-4 sm:px-6">
          {!available ? (
            <p className="mr-auto text-xs text-muted-foreground">
              {t("releaseHealth.connections.editor.previewFooter")}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("releaseHealth.common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!available || !tested || !valid || busy}
            onClick={save}
          >
            {t("releaseHealth.connections.editor.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ProviderSelector({
  provider,
  onChange,
}: {
  provider: SourceConnectionProviderType
  onChange: (provider: SourceConnectionProviderType) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <Label id="source-connection-provider-label">
        {t("releaseHealth.connections.provider")}
      </Label>
      <div
        role="group"
        aria-labelledby="source-connection-provider-label"
        className="grid gap-2 sm:grid-cols-2"
      >
        {providerOptions.map((option) => {
          const selected = provider === option.type
          const Icon = option.icon
          return (
            <button
              key={option.type}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.type)}
              className={cn(
                "rounded-lg border bg-background p-3 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                selected && "border-primary bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md border bg-muted/30 p-2">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {t(
                        `releaseHealth.connections.editor.providers.${option.type}.name`
                      )}
                    </span>
                    <Badge variant={option.available ? "secondary" : "outline"}>
                      {t(
                        option.available
                          ? "releaseHealth.connections.editor.available"
                          : "releaseHealth.connections.editor.comingSoon"
                      )}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(
                      `releaseHealth.connections.editor.providers.${option.type}.description`
                    )}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
