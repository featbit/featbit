import { Copy, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  EnvironmentSecret,
  ProjectEnvironment,
} from "@/features/organization/projects/projects-api"
import { IconTooltip, maskSecret, TypeBadge } from "./inventory-shared"

function SecretValue({
  secret,
  onCopy,
}: {
  secret: EnvironmentSecret
  onCopy: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid min-w-0 grid-cols-[minmax(64px,104px)_auto_24ch_auto] items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="truncate text-xs font-medium text-foreground" />
            }
          >
            {secret.name}
          </TooltipTrigger>
          <TooltipContent>{secret.name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TypeBadge type={secret.type} />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" />
            }
          >
            {maskSecret(secret.value)}
          </TooltipTrigger>
          <TooltipContent>{maskSecret(secret.value)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <IconTooltip label={t("organization.projects.actions.copySecret")}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("organization.projects.actions.copySecret")}
          onClick={() => onCopy(secret.value)}
        >
          <Copy className="size-3" />
        </Button>
      </IconTooltip>
    </div>
  )
}

export function SecretsCell({
  environment,
  onAddSecret,
  onCopySecret,
  onViewSecrets,
}: {
  environment: ProjectEnvironment
  onAddSecret: (environment: ProjectEnvironment) => void
  onCopySecret: (value: string) => void
  onViewSecrets: (environment: ProjectEnvironment) => void
}) {
  const { t } = useTranslation()
  const visibleSecrets = environment.secrets.slice(0, 2)
  const hiddenCount = Math.max(
    environment.secrets.length - visibleSecrets.length,
    0
  )

  return (
    <div className="min-w-0 space-y-1.5">
      {visibleSecrets.length > 0 ? (
        visibleSecrets.map((secret) => (
          <SecretValue key={secret.id} secret={secret} onCopy={onCopySecret} />
        ))
      ) : (
        <div className="text-xs text-muted-foreground">
          {t("organization.projects.emptySecrets")}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 px-1.5"
          onClick={() => onAddSecret(environment)}
        >
          <Plus className="size-3" />
          {t("organization.projects.actions.addSecret")}
        </Button>
        {environment.secrets.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 px-1.5"
            onClick={() => onViewSecrets(environment)}
          >
            {t("organization.projects.actions.viewSecrets")}
          </Button>
        ) : null}
        {hiddenCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("organization.projects.moreSecrets", { count: hiddenCount })}
          </span>
        ) : null}
      </div>
    </div>
  )
}
