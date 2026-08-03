import { Box, Braces, Check, ChevronDown, Copy, Settings } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { EnvironmentSecret } from "@/features/layout/layout-types"
import {
  resolveSdkEndpoints,
  type SdkEndpoint,
} from "@/features/layout/sdk-endpoints"

function maskSecret(value: string) {
  return value ? `********${value.slice(-4)}` : "********"
}

function SecretTypeBadge({ type }: { type: EnvironmentSecret["type"] }) {
  const { t } = useTranslation()

  return (
    <Badge variant="outline" className="h-5 shrink-0 px-1.5 font-normal">
      {type === "server"
        ? t("layout.context.secretTypes.server")
        : t("layout.context.secretTypes.client")}
    </Badge>
  )
}

function CopyStatus({
  copied,
  copiedLabel,
}: {
  copied: boolean
  copiedLabel: string
}) {
  return (
    <span
      className={`flex w-[4.5rem] shrink-0 items-center justify-end gap-1.5 text-xs ${
        copied ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {copied ? (
        <>
          <Check className="size-4" />
          <span>{copiedLabel}</span>
        </>
      ) : (
        <Copy className="size-4" />
      )}
    </span>
  )
}

function EndpointValue({
  value,
  notConfiguredLabel,
}: {
  value: string
  notConfiguredLabel: string
}) {
  if (!value) {
    return (
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {notConfiguredLabel}
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <code className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
            {value}
          </code>
        }
      />
      <TooltipContent
        side="bottom"
        align="end"
        className="max-w-[22rem] font-mono break-all"
      >
        {value}
      </TooltipContent>
    </Tooltip>
  )
}

export function EnvironmentSdkConfigurationPopover({
  open,
  onOpenChange,
  projectName,
  environmentName,
  secrets,
  manageHref,
  disabled = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  environmentName: string
  secrets: readonly EnvironmentSecret[]
  manageHref: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [copiedValueId, setCopiedValueId] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<number | null>(null)
  const endpoints = resolveSdkEndpoints()
  const endpointLabels: Record<SdkEndpoint["id"], string> = {
    streamingUrl: t("layout.context.streamingUrl"),
    eventUrl: t("layout.context.eventUrl"),
    openApiEndpoint: t("layout.context.openApiEndpoint"),
  }

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
    }
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setTooltipOpen(false)
    }
    onOpenChange(nextOpen)
  }

  async function copyValue({
    id,
    name,
    value,
  }: {
    id: string
    name: string
    value: string
  }) {
    if (!value) {
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopiedValueId(id)

      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopiedValueId(null)
      }, 1500)
    } catch {
      toast.error(t("layout.context.copyValueFailed", { name }))
    }
  }

  return (
    <TooltipProvider delay={300}>
      <DropdownMenu open={open} modal={false} onOpenChange={handleOpenChange}>
        <Tooltip open={tooltipOpen && !open} onOpenChange={setTooltipOpen}>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className={`h-8 gap-1.5 px-2 ${
                      open
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    }`}
                    aria-label={t("layout.context.viewAndCopySdkConfiguration")}
                    aria-expanded={open}
                    disabled={disabled}
                  >
                    <Braces aria-hidden className="size-3.5" />
                    <span>{t("layout.context.sdkConfigTrigger")}</span>
                    <ChevronDown aria-hidden className="size-3.5" />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>
            {t("layout.context.viewAndCopySdkConfiguration")}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="max-h-[calc(100vh-1.5rem)] w-[25rem] max-w-[calc(100vw-1.5rem)] rounded-lg border-border/80 p-0 shadow-lg"
        >
          <div className="px-4 py-3">
            <p className="text-sm font-medium">
              {t("layout.context.sdkConfiguration")}
            </p>
            <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <Box aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{projectName}</span>
              <span className="shrink-0">/</span>
              <span className="truncate">{environmentName}</span>
            </div>
          </div>
          <DropdownMenuSeparator className="mx-0 my-0" />

          <div className="p-1.5">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {t("layout.context.endpoints")}
            </p>
            {endpoints.map((endpoint) => {
              const label = endpointLabels[endpoint.id]
              const copyId = `endpoint:${endpoint.id}`

              return (
                <DropdownMenuItem
                  key={endpoint.id}
                  closeOnClick={false}
                  disabled={!endpoint.value}
                  className="min-h-12 items-center rounded-md px-2.5 py-2"
                  aria-label={
                    endpoint.value
                      ? t("layout.context.copyValue", { name: label })
                      : undefined
                  }
                  onClick={() =>
                    void copyValue({
                      id: copyId,
                      name: label,
                      value: endpoint.value,
                    })
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{label}</p>
                    <EndpointValue
                      value={endpoint.value}
                      notConfiguredLabel={t("layout.context.notConfigured")}
                    />
                  </div>
                  {endpoint.value ? (
                    <CopyStatus
                      copied={copiedValueId === copyId}
                      copiedLabel={t("layout.context.copied")}
                    />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </div>

          <DropdownMenuSeparator className="mx-0 my-0" />

          <div className="p-1.5">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("layout.context.environmentSecrets")}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {secrets.length}
              </span>
            </div>
            <div className="max-h-48 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto">
              {secrets.length ? (
                secrets.map((secret) => {
                  const copyId = `secret:${secret.id}`

                  return (
                    <DropdownMenuItem
                      key={secret.id}
                      closeOnClick={false}
                      className="min-h-12 items-center rounded-md px-2.5 py-2"
                      aria-label={t("layout.context.copyValue", {
                        name: secret.name,
                      })}
                      onClick={() =>
                        void copyValue({
                          id: copyId,
                          name: secret.name,
                          value: secret.value,
                        })
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {secret.name}
                          </span>
                          <SecretTypeBadge type={secret.type} />
                        </div>
                        <code className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                          {maskSecret(secret.value)}
                        </code>
                      </div>
                      <CopyStatus
                        copied={copiedValueId === copyId}
                        copiedLabel={t("layout.context.copied")}
                      />
                    </DropdownMenuItem>
                  )
                })
              ) : (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("layout.context.noEnvironmentSecrets")}
                </p>
              )}
            </div>
          </div>

          <DropdownMenuSeparator className="mx-0 my-0" />
          <DropdownMenuItem
            className="m-1.5 h-9 px-2 text-muted-foreground"
            render={<Link to={manageHref} />}
            onClick={() => handleOpenChange(false)}
          >
            <Settings className="size-4" />
            {t("layout.context.manageSecrets")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
