import { PreviewCard } from "@base-ui/react/preview-card"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ScopeResource, SegmentType } from "../segments-types"
import { ScopeResourceIcon } from "../index/components/scope-resource-icon"

const typeTriggerClassName =
  "-mx-1.5 inline-flex cursor-help items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"

function TypeTriggerContent({ label }: { label: string }) {
  return (
    <>
      <span>{label}</span>
      <Info className="size-3.5 shrink-0 text-muted-foreground" />
    </>
  )
}

function scopeResourceType(scope: string): ScopeResource["type"] {
  const type = scope.split(":").at(-1)?.split("/")[0]
  if (type === "project" || type === "env") return type
  return "organization"
}

export function SegmentTypeCell({
  type,
  scopes = [],
}: {
  type: SegmentType | string
  scopes?: string[]
}) {
  const { t } = useTranslation()

  if (type === "shared") {
    return (
      <PreviewCard.Root>
        <PreviewCard.Trigger
          delay={200}
          closeDelay={100}
          render={<button type="button" className={typeTriggerClassName} />}
        >
          <TypeTriggerContent label={t("segments.shareable")} />
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner
            align="start"
            sideOffset={4}
            className="z-[60]"
            data-slot="segment-type-preview-positioner"
          >
            <PreviewCard.Popup className="w-96 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none">
              <p className="mb-2 text-sm font-medium">
                {t("segments.sharedScopes")}
              </p>
              {scopes.length ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {scopes.map((scope) => (
                    <li
                      key={scope}
                      className="flex items-start gap-2 rounded-md px-1.5 py-1"
                    >
                      <ScopeResourceIcon
                        type={scopeResourceType(scope)}
                        className="mt-0.5 size-3.5"
                      />
                      <span className="min-w-0 font-mono break-all">
                        {scope}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("segments.noSharedScopes")}
                </p>
              )}
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={typeTriggerClassName} tabIndex={0} />}
      >
        <TypeTriggerContent label={t("segments.currentEnvironment")} />
      </TooltipTrigger>
      <TooltipContent>{t("segments.currentEnvironmentHelp")}</TooltipContent>
    </Tooltip>
  )
}
