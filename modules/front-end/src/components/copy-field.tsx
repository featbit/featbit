import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function CopyField({
  id,
  value,
  buttonLabel,
  tooltip,
  ariaLabel,
  className,
  onCopy,
}: {
  id?: string
  value: string
  buttonLabel: string
  tooltip: string
  ariaLabel?: string
  className?: string
  onCopy: () => void
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg border bg-background px-2.5",
        className
      )}
    >
      <code id={id} className="min-w-0 flex-1 truncate text-sm font-semibold">
        {value}
      </code>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 shrink-0 gap-1.5 bg-background px-2 text-xs"
                aria-label={ariaLabel ?? tooltip}
                onClick={onCopy}
              >
                <Copy className="size-3.5" />
                {buttonLabel}
              </Button>
            }
          />
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
