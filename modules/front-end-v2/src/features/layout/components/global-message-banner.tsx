import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { buttonVariants } from "@/components/ui/button"
import type {
  GlobalMessage,
  GlobalMessageVariant,
} from "@/features/layout/global-message"
import { localizedPath } from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"

const globalMessageStyles: Record<
  GlobalMessageVariant,
  {
    container: string
    icon: string
    text: string
    button: string
    Icon: typeof Info
  }
> = {
  info: {
    container:
      "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100",
    icon: "text-blue-600 dark:text-blue-300",
    text: "text-blue-900/80 dark:text-blue-100/80",
    button: "bg-card text-card-foreground shadow-sm hover:bg-accent",
    Icon: Info,
  },
  success: {
    container:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-300",
    text: "text-emerald-900/80 dark:text-emerald-100/80",
    button: "bg-card text-card-foreground shadow-sm hover:bg-accent",
    Icon: CheckCircle2,
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-300",
    text: "text-amber-900/80 dark:text-amber-100/80",
    button: "bg-card text-card-foreground shadow-sm hover:bg-accent",
    Icon: AlertTriangle,
  },
  destructive: {
    container:
      "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/20",
    icon: "text-destructive",
    text: "text-destructive/80",
    button: "bg-card text-card-foreground shadow-sm hover:bg-accent",
    Icon: AlertCircle,
  },
}

export function GlobalMessageBanner({ message }: { message?: GlobalMessage }) {
  const { t } = useTranslation()

  if (!message) {
    return null
  }

  const styles = globalMessageStyles[message.variant]
  const MessageIcon = styles.Icon

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center border-b px-5",
        styles.container
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <MessageIcon className={cn("h-4 w-4 shrink-0", styles.icon)} />
        <span className="shrink-0 font-semibold">
          {t(message.titleKey, message.values)}
        </span>
        <span className={cn("truncate", styles.text)}>
          {t(message.descriptionKey, message.values)}
        </span>
      </div>
      <Link
        to={localizedPath(message.lang, "/app/workspace/billing?open=pricing")}
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: cn("ml-3 h-7 shrink-0 px-3", styles.button),
        })}
      >
        {t("layout.globalMessage.upgradePlan")}
      </Link>
    </div>
  )
}
