import { Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TriggerConfirmation } from "./trigger-confirm-dialog"
import {
  flagTriggerUrl,
  maskedFlagTriggerUrl,
  type FlagTrigger,
} from "./triggers-api"

function preciseDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "long",
  }).format(new Date(value))
}

function compactDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function TriggerTableRow({
  trigger,
  token,
  locale,
  editable,
  toggling,
  onToggle,
  onCopy,
  onConfirm,
}: {
  trigger: FlagTrigger
  token?: string
  locale: string
  editable: boolean
  toggling: boolean
  onToggle: (isEnabled: boolean) => void
  onCopy: () => void
  onConfirm: (target: Exclude<TriggerConfirmation, null>) => void
}) {
  const { t } = useTranslation()
  const usage = trigger.triggeredTimes ?? 0

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="px-4 py-3 whitespace-normal">
        <p className="font-medium">
          {t("featureFlags.detailsPage.triggers.general")}
        </p>
        {trigger.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {trigger.description}
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="min-w-24 bg-background font-normal">
          {t(
            trigger.action === "turn-on"
              ? "featureFlags.detailsPage.triggers.turnOn"
              : "featureFlags.detailsPage.triggers.turnOff"
          )}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={trigger.isEnabled}
            disabled={!editable || toggling}
            aria-label={t("featureFlags.detailsPage.triggers.toggleStatus", {
              description:
                trigger.description ||
                t("featureFlags.detailsPage.triggers.general"),
            })}
            onCheckedChange={onToggle}
          />
          <span className="text-xs font-medium">
            {t(
              trigger.isEnabled
                ? "featureFlags.detailsPage.triggers.enabled"
                : "featureFlags.detailsPage.triggers.disabled"
            )}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3 whitespace-normal">
        {token ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  className="h-8 w-full max-w-full justify-start gap-2.5 px-2.5 font-normal"
                  variant="outline"
                  disabled={!editable}
                  aria-label={t("featureFlags.detailsPage.triggers.copyUrl")}
                  onClick={onCopy}
                >
                  <code className="min-w-0 flex-1 truncate text-left text-xs">
                    {flagTriggerUrl(token)}
                  </code>
                  <Copy className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>
              {t("featureFlags.detailsPage.triggers.copyUrl")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex h-8 max-w-full items-center rounded-lg border bg-background px-2.5">
            <code className="min-w-0 flex-1 truncate text-xs">
              {maskedFlagTriggerUrl()}
            </code>
          </div>
        )}
        {token ? (
          <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t("featureFlags.detailsPage.triggers.revealWarning")}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="py-3 whitespace-normal">
        <p className="font-medium tabular-nums">{usage}</p>
        {trigger.lastTriggeredAt ? (
          <Tooltip>
            <TooltipTrigger className="mt-0.5 block text-left text-xs text-muted-foreground">
              {t("featureFlags.detailsPage.triggers.lastTriggered", {
                date: compactDate(trigger.lastTriggeredAt, locale),
              })}
            </TooltipTrigger>
            <TooltipContent>
              {preciseDate(trigger.lastTriggeredAt, locale)}
            </TooltipContent>
          </Tooltip>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("featureFlags.detailsPage.triggers.neverTriggered")}
          </p>
        )}
        {trigger.updatedAt ? (
          <Tooltip>
            <TooltipTrigger className="mt-0.5 block text-left text-xs text-muted-foreground">
              {t("featureFlags.detailsPage.triggers.lastUpdated", {
                date: compactDate(trigger.updatedAt, locale),
              })}
            </TooltipTrigger>
            <TooltipContent>
              {preciseDate(trigger.updatedAt, locale)}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </TableCell>
      <TableCell className="px-4">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="font-medium"
            disabled={!editable}
            onClick={() => onConfirm({ kind: "reset", trigger })}
          >
            {t("featureFlags.detailsPage.triggers.reset")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={!editable}
            onClick={() => onConfirm({ kind: "remove", trigger })}
          >
            {t("featureFlags.detailsPage.triggers.remove")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
