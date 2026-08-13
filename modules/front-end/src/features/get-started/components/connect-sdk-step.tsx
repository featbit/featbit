import { Check, CircleAlert, Eye, EyeOff, ExternalLink } from "lucide-react"
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
import { SdkEndpointsPopover } from "./sdk-endpoints-popover"

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
  const compatibleSecrets = useMemo(
    () =>
      environment?.secrets.filter(
        (secret) => secret.type === definition.recommendedSecretType
      ) ?? [],
    [definition.recommendedSecretType, environment?.secrets]
  )
  const selectedSecret = compatibleSecrets.find(
    (secret) => secret.id === selectedSecretId
  )
  const secretVisible = Boolean(
    selectedSecretId && revealedSecretId === selectedSecretId
  )

  useEffect(() => {
    const nextSecretId = selectedSecret?.id ?? compatibleSecrets[0]?.id ?? ""
    if (nextSecretId !== selectedSecretId) onSecretChange(nextSecretId)
  }, [compatibleSecrets, onSecretChange, selectedSecret, selectedSecretId])

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
  const ready = Boolean(
    selectedSecret &&
    selectedSecret.type === definition.recommendedSecretType &&
    streamingUrl &&
    eventUrl
  )
  const endpointRows = [
    {
      id: "streamingUrl",
      label: t("getStarted.connectSdk.streamingUrl"),
      value: streamingUrl,
    },
    {
      id: "eventUrl",
      label: t("getStarted.connectSdk.eventUrl"),
      value: eventUrl,
    },
    {
      id: "openApiEndpoint",
      label: t("getStarted.connectSdk.openApiEndpoint"),
      value: openApiEndpoint,
    },
  ]
  const sdkSide =
    definition.recommendedSecretType === "client"
      ? t("getStarted.connectSdk.clientSide")
      : t("getStarted.connectSdk.serverSide")
  const secretTypeLabel = t(
    `getStarted.common.${definition.recommendedSecretType}`
  )

  return (
    <section className="isolate flex min-h-[46rem] flex-col rounded-lg border bg-card">
      <header className="border-b px-5 py-4">
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

      <div className="grid flex-1 gap-5 px-5 py-4 @min-[52rem]:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b pb-4 @min-[52rem]:border-r @min-[52rem]:border-b-0 @min-[52rem]:pr-4 @min-[52rem]:pb-0">
          <h3 className="text-sm font-semibold">
            {t("getStarted.connectSdk.chooseSdk")}
          </h3>
          <Tabs
            value={sdkId}
            orientation="vertical"
            className="mt-3 block"
            onValueChange={(value) => onSdkChange(value as SdkId)}
          >
            <TabsList
              aria-label={t("getStarted.connectSdk.chooseSdk")}
              className="w-full gap-1 bg-transparent p-0 text-foreground"
            >
              {SDK_DEFINITIONS.map((sdk) => (
                <TabsTrigger
                  key={sdk.id}
                  value={sdk.id}
                  className="h-10 w-full flex-none justify-start rounded-md border border-transparent px-3 py-0 font-normal text-foreground shadow-none hover:bg-muted/60 data-active:border-border data-active:bg-muted data-active:font-medium data-active:shadow-none"
                >
                  <span className="truncate">{sdk.label}</span>
                  {sdk.id === sdkId ? (
                    <Check aria-hidden className="ml-auto size-4" />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <h3 className="truncate text-lg font-semibold">
                {definition.label} SDK
              </h3>
              <Badge
                variant="outline"
                className="h-6 shrink-0 px-2 font-normal"
              >
                {sdkSide}
              </Badge>
            </div>
            <a
              href={definition.documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t("getStarted.connectSdk.viewDocumentationShort")}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              {t("getStarted.connectSdk.configuration")}
            </h3>
            {environmentLoading ? (
              <div
                role="status"
                aria-label={t("getStarted.connectSdk.loadingConfiguration")}
                className="grid min-h-14 items-center gap-3 rounded-lg border px-3 py-2 @min-[56rem]:grid-cols-[8rem_9rem_minmax(0,1fr)_auto]"
              >
                <span className="sr-only">
                  {t("getStarted.connectSdk.loadingConfiguration")}
                </span>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-28" />
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
              <div className="grid min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-sm @min-[56rem]:grid-cols-[8rem_9rem_minmax(0,1fr)_auto]">
                <span>{t("getStarted.connectSdk.environmentSecret")}</span>
                {compatibleSecrets.length ? (
                  <>
                    <Select
                      value={selectedSecretId || null}
                      onValueChange={(value) => value && onSecretChange(value)}
                    >
                      <SelectTrigger size="sm" className="w-full min-w-0">
                        <SelectValue>
                          {selectedSecret
                            ? selectedSecret.name
                            : t("getStarted.connectSdk.selectSecret")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectGroup>
                          {compatibleSecrets.map((secret) => (
                            <SelectItem key={secret.id} value={secret.id}>
                              <span className="min-w-0 truncate">
                                {secret.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <code className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {selectedSecret
                        ? secretVisible
                          ? selectedSecret.value
                          : maskSecret(selectedSecret.value)
                        : t("getStarted.common.notConfigured")}
                    </code>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 shrink-0"
                        disabled={!selectedSecret}
                        aria-label={
                          secretVisible
                            ? t("getStarted.connectSdk.hideSecret")
                            : t("getStarted.connectSdk.showSecret")
                        }
                        onClick={() =>
                          setRevealedSecretId((current) =>
                            current === selectedSecretId ? "" : selectedSecretId
                          )
                        }
                      >
                        {secretVisible ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                      <CopyButton
                        value={selectedSecret?.value ?? ""}
                        iconOnly
                      />
                      <span
                        aria-hidden
                        className="mx-1 h-5 w-px shrink-0 bg-border"
                      />
                      <SdkEndpointsPopover endpoints={endpointRows} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 @min-[56rem]:col-span-2">
                      <p className="truncate text-sm text-destructive">
                        {t("getStarted.connectSdk.noCompatibleSecrets", {
                          type: secretTypeLabel,
                        })}
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
                    <div className="flex justify-end">
                      <SdkEndpointsPopover endpoints={endpointRows} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              {t("getStarted.connectSdk.installPackage")}
            </h3>
            <CodeBlock
              code={definition.install}
              language={definition.installLanguage}
              maxHeightClassName="max-h-24"
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
              maxHeightClassName="min-h-48 max-h-60"
            />
          </div>
        </div>
      </div>

      <footer className="flex min-h-16 items-center justify-between rounded-b-lg border-t bg-card px-5 py-3">
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
