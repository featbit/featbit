import { Check, Copy, KeyRound, Settings } from "lucide-react"
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

export function EnvironmentSecretsPopover({
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
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<number | null>(null)

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

  async function copySecret(secret: EnvironmentSecret) {
    try {
      await navigator.clipboard.writeText(secret.value)
      setCopiedSecretId(secret.id)
      toast.success(t("layout.context.secretCopied", { name: secret.name }))

      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopiedSecretId(null)
      }, 1500)
    } catch {
      toast.error(t("layout.context.copySecretFailed", { name: secret.name }))
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
                    size="icon"
                    className="-ml-1 size-8"
                    aria-label={t(
                      "layout.context.viewAndCopyEnvironmentSecrets"
                    )}
                    aria-expanded={open}
                    disabled={disabled}
                  >
                    <KeyRound className="size-3.5 text-muted-foreground" />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>
            {t("layout.context.viewAndCopyEnvironmentSecrets")}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[21rem] rounded-lg border-border/80 p-0 shadow-lg"
        >
          <div className="px-3 py-2.5">
            <p className="text-sm font-medium">
              {t("layout.context.environmentSecrets")}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {projectName} / {environmentName}
            </p>
          </div>
          <DropdownMenuSeparator className="mx-0 my-0" />

          <div className="max-h-64 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto p-1">
            {secrets.length ? (
              secrets.map((secret) => {
                const copied = copiedSecretId === secret.id

                return (
                  <DropdownMenuItem
                    key={secret.id}
                    closeOnClick={false}
                    className="min-h-12 items-center rounded-md px-2.5 py-2"
                    aria-label={t("layout.context.copySecret", {
                      name: secret.name,
                    })}
                    onClick={() => void copySecret(secret)}
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
                    {copied ? (
                      <Check className="size-4 text-foreground" />
                    ) : (
                      <Copy className="size-4 text-muted-foreground" />
                    )}
                  </DropdownMenuItem>
                )
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("layout.context.noEnvironmentSecrets")}
              </p>
            )}
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
