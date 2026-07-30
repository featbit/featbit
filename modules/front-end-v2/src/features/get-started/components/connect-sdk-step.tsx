import {
  Circle,
  CircleAlert,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { localizedPath } from "@/features/layout/layout-context"
import { resolveSdkEndpoints } from "@/features/layout/sdk-endpoints"
import type { Lang } from "@/features/layout/layout-types"
import { SDK_DEFINITIONS, getSdkDefinition } from "../sdk-definitions"
import type {
  GetStartedEnvironment,
  GetStartedFlag,
  SdkId,
} from "../get-started-types"
import { maskSecret } from "../get-started-utils"
import { CodeBlock } from "./code-block"
import { CopyButton } from "./copy-button"

export function ConnectSdkStep({
  lang,
  flag,
  sdkId,
  environment,
  environmentLoading,
  environmentError,
  selectedSecretId,
  onSdkChange,
  onSecretChange,
  onRetryEnvironment,
  onBack,
  onContinue,
}: {
  lang: Lang
  flag: GetStartedFlag
  sdkId: SdkId
  environment?: GetStartedEnvironment
  environmentLoading: boolean
  environmentError: boolean
  selectedSecretId: string
  onSdkChange: (sdkId: SdkId) => void
  onSecretChange: (secretId: string) => void
  onRetryEnvironment: () => void
  onBack: () => void
  onContinue: () => void
}) {
  const [revealedSecretId, setRevealedSecretId] = useState("")
  const definition = getSdkDefinition(sdkId)
  const endpoints = useMemo(() => resolveSdkEndpoints(), [])
  const streamingUrl =
    endpoints.find((endpoint) => endpoint.id === "streamingUrl")?.value ?? ""
  const eventUrl =
    endpoints.find((endpoint) => endpoint.id === "eventUrl")?.value ?? ""
  const openApiEndpoint =
    endpoints.find((endpoint) => endpoint.id === "openApiEndpoint")?.value ?? ""
  const selectedSecret = environment?.secrets.find(
    (secret) => secret.id === selectedSecretId
  )
  const secretVisible = Boolean(
    selectedSecretId && revealedSecretId === selectedSecretId
  )

  useEffect(() => {
    if (selectedSecret || !environment?.secrets.length) return
    const recommended =
      environment.secrets.find(
        (secret) => secret.type === definition.recommendedSecretType
      ) ?? environment.secrets[0]
    onSecretChange(recommended.id)
  }, [
    definition.recommendedSecretType,
    environment,
    onSecretChange,
    selectedSecret,
  ])

  const secretValue = selectedSecret?.value ?? "the-sdk-secret"
  const snippet = definition.buildSnippet({
    flagKey: flag.key,
    secret: secretValue,
    eventUrl: eventUrl || "https://evaluation.example.com",
    streamingUrl: streamingUrl || "wss://evaluation.example.com",
  })
  const visibleSnippet =
    selectedSecret && !secretVisible
      ? snippet.replaceAll(
          selectedSecret.value,
          maskSecret(selectedSecret.value)
        )
      : snippet
  const ready = Boolean(selectedSecret && streamingUrl && eventUrl)
  const endpointRows = [
    { label: "Streaming URL", value: streamingUrl },
    { label: "Event URL", value: eventUrl },
    { label: "Open API endpoint", value: openApiEndpoint },
  ]
  const configurationRowClass =
    "grid items-center gap-3 px-4 py-2 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.3fr)_4.5rem]"

  return (
    <section className="flex min-h-[46rem] flex-col rounded-lg border bg-card">
      <header className="px-5 pt-5">
        <h2 className="text-xl font-semibold">Connect an SDK</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose your stack, copy the configuration, then run your app.
        </p>
      </header>

      <div className="flex-1 space-y-5 px-5 py-4">
        <Alert className="border-amber-200 bg-amber-50/50 text-foreground dark:border-amber-900/70 dark:bg-amber-950/20">
          <Circle className="mt-1 size-2.5 fill-amber-500 text-amber-500" />
          <AlertTitle>Waiting for your first evaluation</AlertTitle>
          <AlertDescription>
            Run your app, then continue when you&apos;re ready.
          </AlertDescription>
        </Alert>

        <Tabs
          value={sdkId}
          onValueChange={(value) => onSdkChange(value as SdkId)}
        >
          <TabsList
            variant="line"
            className="no-scrollbar w-full justify-start gap-5 overflow-x-auto border-b px-1 pb-1"
          >
            {SDK_DEFINITIONS.map((sdk) => (
              <TabsTrigger key={sdk.id} value={sdk.id} className="px-3">
                {sdk.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">SDK configuration</h3>
          {environmentLoading ? (
            <div className="flex h-36 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading environment configuration...
            </div>
          ) : environmentError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Environment configuration is unavailable</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>Check your connection and try again.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetryEnvironment}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-hidden rounded-lg border text-sm">
              <div className={`${configurationRowClass} min-h-10 border-b`}>
                <span>Environment secret</span>
                {environment?.secrets.length ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <Select
                      value={selectedSecretId || null}
                      onValueChange={(value) => value && onSecretChange(value)}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-full min-w-0 sm:max-w-56"
                      >
                        <SelectValue>
                          {selectedSecret
                            ? `${selectedSecret.name} · ${selectedSecret.type}`
                            : "Select secret"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectGroup>
                          {environment.secrets.map((secret) => (
                            <SelectItem key={secret.id} value={secret.id}>
                              <span className="min-w-0 truncate">
                                {secret.name}
                              </span>
                              <Badge variant="outline" className="ml-auto">
                                {secret.type.toUpperCase()}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {selectedSecret ? (
                      <>
                        <Badge variant="outline" className="shrink-0">
                          {selectedSecret.type.toUpperCase()}
                        </Badge>
                        <code className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground lg:block">
                          {secretVisible
                            ? selectedSecret.value
                            : maskSecret(selectedSecret.value)}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 shrink-0"
                          aria-label={
                            secretVisible
                              ? "Hide environment secret"
                              : "Show environment secret"
                          }
                          onClick={() =>
                            setRevealedSecretId((current) =>
                              current === selectedSecretId
                                ? ""
                                : selectedSecretId
                            )
                          }
                        >
                          {secretVisible ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-sm text-destructive">
                      No environment secrets
                    </p>
                    <a
                      href={localizedPath(
                        lang,
                        "/organization/projects?view=secrets"
                      )}
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      Manage secrets
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-end">
                  {selectedSecret ? (
                    <CopyButton value={selectedSecret.value} />
                  ) : null}
                </div>
              </div>
              {endpointRows.map((row) => (
                <div
                  key={row.label}
                  className={`${configurationRowClass} min-h-9 border-b last:border-b-0`}
                >
                  <span>{row.label}</span>
                  <code className="min-w-0 truncate text-xs text-muted-foreground">
                    {row.value || "Not configured"}
                  </code>
                  <CopyButton value={row.value} />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {definition.label} works best with a{" "}
            {definition.recommendedSecretType} secret. You can select another
            available secret when needed.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">1. Install package</h3>
          <CodeBlock
            code={definition.install}
            language={definition.installLanguage}
            maxHeightClassName="max-h-36"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">2. Initialize client</h3>
          <CodeBlock
            code={visibleSnippet}
            copyValue={snippet}
            language={definition.codeLanguage}
            highlight
            lineNumbers
            maxHeightClassName="max-h-60"
          />
          <a
            href={definition.documentationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            View {definition.label} SDK documentation
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <footer className="flex min-h-16 items-center justify-between border-t bg-muted/10 px-5 py-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={!ready} onClick={onContinue}>
          Continue to verification
        </Button>
      </footer>
    </section>
  )
}
