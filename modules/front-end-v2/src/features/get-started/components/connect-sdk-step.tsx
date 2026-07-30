import { CircleAlert, Eye, EyeOff, ExternalLink, Info } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  const { t } = useTranslation()
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
    {
      label: t("getStarted.connectSdk.streamingUrl"),
      value: streamingUrl,
    },
    { label: t("getStarted.connectSdk.eventUrl"), value: eventUrl },
    {
      label: t("getStarted.connectSdk.openApiEndpoint"),
      value: openApiEndpoint,
    },
  ]
  const configurationRowClass =
    "grid items-center gap-3 px-4 py-2 @min-[42rem]:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.3fr)_4.5rem]"

  return (
    <section className="flex min-h-[46rem] flex-col rounded-lg border bg-card">
      <header className="px-5 pt-5">
        <h2
          data-get-started-step-heading
          tabIndex={-1}
          className="rounded-sm text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {t("getStarted.connectSdk.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("getStarted.connectSdk.subtitle")}
        </p>
      </header>

      <div className="flex-1 space-y-5 px-5 py-4">
        <Alert>
          <Info />
          <AlertTitle>{t("getStarted.connectSdk.setupTitle")}</AlertTitle>
          <AlertDescription>
            {t("getStarted.connectSdk.setupDescription")}
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
          <h3 className="text-sm font-semibold">
            {t("getStarted.connectSdk.configuration")}
          </h3>
          {environmentLoading ? (
            <div
              role="status"
              aria-label={t("getStarted.connectSdk.loadingConfiguration")}
              className="overflow-hidden rounded-lg border"
            >
              <span className="sr-only">
                {t("getStarted.connectSdk.loadingConfiguration")}
              </span>
              {["secret", "streaming", "events", "open-api"].map(
                (row, index) => (
                  <div
                    key={row}
                    className={`${configurationRowClass} min-h-9 border-b last:border-b-0`}
                  >
                    <Skeleton className="h-4 w-28" />
                    <Skeleton
                      className={
                        index === 0 ? "h-7 w-full max-w-64" : "h-4 w-44"
                      }
                    />
                    <Skeleton className="ml-auto h-7 w-14" />
                  </div>
                )
              )}
            </div>
          ) : environmentError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>
                {t("getStarted.connectSdk.configurationUnavailable")}
              </AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>
                  {t(
                    "getStarted.connectSdk.configurationUnavailableDescription"
                  )}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetryEnvironment}
                >
                  {t("getStarted.common.retry")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-hidden rounded-lg border text-sm">
              <div className={`${configurationRowClass} min-h-10 border-b`}>
                <span>{t("getStarted.connectSdk.environmentSecret")}</span>
                {environment?.secrets.length ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <Select
                      value={selectedSecretId || null}
                      onValueChange={(value) => value && onSecretChange(value)}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-full min-w-0 @min-[42rem]:max-w-56"
                      >
                        <SelectValue>
                          {selectedSecret
                            ? selectedSecret.name
                            : t("getStarted.connectSdk.selectSecret")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectGroup>
                          {environment.secrets.map((secret) => (
                            <SelectItem key={secret.id} value={secret.id}>
                              <span className="min-w-0 truncate">
                                {secret.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="ml-auto uppercase"
                              >
                                {t(`getStarted.common.${secret.type}`)}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {selectedSecret ? (
                      <>
                        <Badge variant="outline" className="shrink-0 uppercase">
                          {t(`getStarted.common.${selectedSecret.type}`)}
                        </Badge>
                        <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
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
                              ? t("getStarted.connectSdk.hideSecret")
                              : t("getStarted.connectSdk.showSecret")
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
                      {t("getStarted.connectSdk.noSecrets")}
                    </p>
                    <a
                      href={localizedPath(
                        lang,
                        "/organization/projects?view=secrets"
                      )}
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {t("getStarted.connectSdk.manageSecrets")}
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
                    {row.value || t("getStarted.common.notConfigured")}
                  </code>
                  <CopyButton value={row.value} />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t("getStarted.connectSdk.recommendedSecret", {
              sdk: definition.label,
              type: t(`getStarted.common.${definition.recommendedSecretType}`),
            })}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t("getStarted.connectSdk.installPackage")}
          </h3>
          <CodeBlock
            code={definition.install}
            language={definition.installLanguage}
            maxHeightClassName="max-h-36"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t("getStarted.connectSdk.initializeClient")}
          </h3>
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
            {t("getStarted.connectSdk.viewDocumentation", {
              sdk: definition.label,
            })}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <footer className="sticky bottom-0 z-10 flex min-h-16 items-center justify-between rounded-b-lg border-t bg-card/95 px-5 py-3 supports-[backdrop-filter]:bg-card/90 supports-[backdrop-filter]:backdrop-blur-sm">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("getStarted.common.back")}
        </Button>
        <Button type="button" disabled={!ready} onClick={onContinue}>
          {t("getStarted.connectSdk.continueVerification")}
        </Button>
      </footer>
    </section>
  )
}
