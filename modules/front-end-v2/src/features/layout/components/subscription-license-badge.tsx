import { Award, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { buttonVariants } from "@/components/ui/button"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang, Workspace } from "@/features/layout/layout-types"
import { getRuntimeEnv } from "@/lib/env/runtime-env"

const HOSTING_MODE_SAAS = "saas"

function badgeCopy(workspace: Workspace | null) {
  if (getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS) {
    return {
      labelKey: "layout.plan.free",
      valueKey: "layout.plan.upgradeNow",
    }
  }

  if (workspace?.license) {
    return {
      labelKey: "layout.plan.current",
      valueKey: "layout.plan.enterprise",
    }
  }

  return {
    labelKey: "layout.plan.upgradeNow",
    valueKey: "layout.plan.getEnterprise",
  }
}

export function SubscriptionLicenseBadge({
  lang,
  workspace,
}: {
  lang: Lang
  workspace: Workspace | null
}) {
  const { t } = useTranslation()
  const copy = badgeCopy(workspace)
  const label = t(copy.labelKey)
  const value = t(copy.valueKey)

  return (
    <Link
      to={localizedPath(lang, "/app/workspace/billing")}
      aria-label={t("layout.plan.aria", { label, plan: value })}
      className={buttonVariants({
        variant: "outline",
        className:
          "h-10 min-w-52 justify-start gap-4 bg-card px-4 text-left shadow-sm hover:bg-accent",
      })}
    >
      <Award className="size-5 text-blue-600" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.625rem] font-medium uppercase text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-[0.8125rem] font-semibold">
          {value}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )
}
