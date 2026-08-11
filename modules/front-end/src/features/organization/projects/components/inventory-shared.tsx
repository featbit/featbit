import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { EnvironmentSecret } from "@/features/organization/projects/projects-api"

export function IconTooltip({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function TypeBadge({ type }: { type: EnvironmentSecret["type"] }) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className="h-5 px-1.5 font-normal">
      {type === "server"
        ? t("organization.projects.secretTypes.serverShort")
        : t("organization.projects.secretTypes.clientShort")}
    </Badge>
  )
}

export function maskSecret(value: string) {
  if (!value) {
    return "********"
  }

  return `********${value.slice(-4)}`
}
