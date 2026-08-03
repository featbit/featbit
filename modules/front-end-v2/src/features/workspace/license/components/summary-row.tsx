import { useTranslation } from "react-i18next"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  DecodedLicense,
  LicenseStatus,
} from "@/features/workspace/license/license-types"
import {
  daysUntilExpiration,
  displayPlan,
  formatDate,
} from "@/features/workspace/license/license-utils"
import { StatusBadge } from "@/features/workspace/license/components/status-badge"

const FOREVER_LICENSE_DAYS_THRESHOLD = 366

function ExpirationValue({
  license,
  lang,
  status,
}: {
  license: DecodedLicense | null
  lang: "en" | "zh"
  status: LicenseStatus
}) {
  const { t } = useTranslation()
  const daysUntilExpiry = daysUntilExpiration(license)
  const isForever = daysUntilExpiry > FOREVER_LICENSE_DAYS_THRESHOLD

  if (!license?.exp || daysUntilExpiry < 0) {
    return <>{formatDate(license?.exp, lang)}</>
  }

  if (isForever) {
    return <>{t("workspace.license.forever")}</>
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span>{formatDate(license.exp, lang)}</span>
      {status === "expiring" ? (
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {t("workspace.license.daysRemaining", { days: daysUntilExpiry })}
        </span>
      ) : null}
    </span>
  )
}

export function SummaryRow({
  license,
  status,
  lang,
}: {
  license: DecodedLicense | null
  status: LicenseStatus
  lang: "en" | "zh"
}) {
  const { t } = useTranslation()
  const items = [
    {
      label: t("workspace.license.currentPlan"),
      value: displayPlan(license?.plan),
    },
    {
      label: t("workspace.license.statusLabel"),
      value: <StatusBadge status={status} />,
    },
    {
      label: t("workspace.license.issuedAt"),
      value: formatDate(license?.iat, lang),
    },
    {
      label: t("workspace.license.expires"),
      value: <ExpirationValue license={license} lang={lang} status={status} />,
    },
  ]

  return (
    <Card className="grid overflow-hidden rounded-md sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "px-3 py-2",
            index > 0 && "border-t sm:border-t-0 sm:border-l"
          )}
        >
          <div className="text-xs leading-4 text-muted-foreground">
            {item.label}
          </div>
          <div className="mt-0.5 text-sm leading-5 font-medium">
            {item.value}
          </div>
        </div>
      ))}
    </Card>
  )
}
