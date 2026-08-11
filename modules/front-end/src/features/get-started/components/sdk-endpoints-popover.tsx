import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CopyButton } from "./copy-button"

type EndpointRow = {
  id: string
  label: string
  value: string
}

function EndpointValue({ value }: { value: string }) {
  const { t } = useTranslation()

  if (!value) {
    return (
      <span className="block truncate font-mono text-xs text-muted-foreground">
        {t("getStarted.common.notConfigured")}
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <code
            tabIndex={0}
            className="block truncate rounded-sm font-mono text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {value}
          </code>
        }
      />
      <TooltipContent
        side="bottom"
        align="end"
        className="max-w-[24rem] font-mono break-all"
      >
        {value}
      </TooltipContent>
    </Tooltip>
  )
}

export function SdkEndpointsPopover({
  endpoints,
}: {
  endpoints: readonly EndpointRow[]
}) {
  const { t } = useTranslation()
  const summary = t("getStarted.connectSdk.endpointsSummary", {
    count: endpoints.length,
  })

  return (
    <TooltipProvider delay={300}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 font-normal"
              aria-label={summary}
            >
              {summary}
              <ChevronDown aria-hidden className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg p-0"
        >
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <p className="text-sm font-medium">
              {t("getStarted.connectSdk.endpoints")}
            </p>
            <span className="text-xs text-muted-foreground tabular-nums">
              {endpoints.length}
            </span>
          </div>
          <div className="divide-y">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="grid min-h-11 grid-cols-[7.5rem_minmax(0,1fr)_1.75rem] items-center gap-2 px-3 py-2"
              >
                <span className="truncate text-xs font-medium">
                  {endpoint.label}
                </span>
                <EndpointValue value={endpoint.value} />
                <CopyButton
                  value={endpoint.value}
                  label={`${t("getStarted.common.copy")} ${endpoint.label}`}
                  iconOnly
                />
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  )
}
