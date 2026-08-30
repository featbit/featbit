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
            variant="outline"
            size="icon"
            aria-label={t(
              copied
                ? "releaseDecision.experiments.detailsPage.copied"
                : "releaseDecision.experiments.detailsPage.copy"
            )}
            onClick={() => void copy()}
          />
        }
      >
        {copied ? <Check /> : <Copy />}
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
