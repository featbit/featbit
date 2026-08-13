import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export function CodePanel({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative overflow-hidden rounded-md bg-slate-950 text-slate-100">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-2 right-2 text-slate-400 hover:bg-white/10 hover:text-white"
        aria-label={t("webhooks.copy")}
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <pre className="max-h-64 overflow-auto p-3 pr-10 font-mono text-xs leading-5 whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  )
}
