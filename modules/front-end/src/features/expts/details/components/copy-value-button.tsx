import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function CopyValueButton({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-5 shrink-0 text-muted-foreground"
            aria-label={t(
              copied
                ? "releaseDecision.experiments.detailsPage.copied"
                : "releaseDecision.experiments.detailsPage.copy"
            )}
            onClick={() => void copy()}
          />
        }
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </TooltipTrigger>
      <TooltipContent>
        {t(
          copied
            ? "releaseDecision.experiments.detailsPage.copied"
            : "releaseDecision.experiments.detailsPage.copy"
        )}
      </TooltipContent>
    </Tooltip>
  )
}
