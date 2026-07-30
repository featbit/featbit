import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CopyButton({
  value,
  label = "Copy",
  iconOnly = false,
  className,
}: {
  value: string
  label?: string
  iconOnly?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Could not copy to clipboard")
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
      aria-label={iconOnly ? label : undefined}
      onClick={() => void copy()}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {!iconOnly ? (copied ? "Copied" : label) : null}
    </Button>
  )
}
