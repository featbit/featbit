import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CopyButton({
  value,
  label,
  iconOnly = false,
  className,
}: {
  value: string
  label?: string
  iconOnly?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const resolvedLabel = label ?? t("getStarted.common.copy")

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(t("getStarted.common.copiedToClipboard"))
    } catch {
      toast.error(t("getStarted.common.copyFailed"))
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      disabled={!value}
      className={cn(
        iconOnly ? "size-7" : "h-7 gap-1.5 px-2 text-xs font-normal",
        className
      )}
      aria-label={iconOnly ? resolvedLabel : undefined}
      onClick={() => void copy()}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {!iconOnly
        ? copied
          ? t("getStarted.common.copied")
          : resolvedLabel
        : null}
    </Button>
  )
}
