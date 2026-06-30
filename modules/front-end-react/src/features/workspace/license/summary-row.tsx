import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DecodedLicense, LicenseStatus } from "./license-types";
import { daysUntilExpiration, displayPlan, formatDate } from "./license-utils";
import { StatusBadge } from "./status-badge";

const FOREVER_LICENSE_DAYS_THRESHOLD = 366;

function ExpirationValue({ license, lang, status }: { license: DecodedLicense | null; lang: "en" | "zh"; status: LicenseStatus }) {
  const { t } = useTranslation();
  const daysUntilExpiry = daysUntilExpiration(license);
  const isForever = daysUntilExpiry > FOREVER_LICENSE_DAYS_THRESHOLD;

  if (!license?.exp || daysUntilExpiry < 0) {
    return <>{formatDate(license?.exp, lang)}</>;
  }

  if (isForever) {
    return <>{t("workspace.license.forever")}</>;
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
  );
}

export function SummaryRow({
  isSaas,
  license,
  status,
  lang
}: {
  isSaas: boolean;
  license: DecodedLicense | null;
  status: LicenseStatus;
  lang: "en" | "zh";
}) {
  const { t } = useTranslation();
  const items = [
    {
      label: isSaas ? t("workspace.license.source") : t("workspace.license.currentPlan"),
      value: isSaas ? t("workspace.license.saasSource") : displayPlan(license?.plan)
    },
    { label: t("workspace.license.statusLabel"), value: <StatusBadge status={status} /> },
    { label: t("workspace.license.issuedAt"), value: formatDate(license?.iat, lang) },
    { label: t("workspace.license.expires"), value: <ExpirationValue license={license} lang={lang} status={status} /> }
  ];

  return (
    <div className="grid overflow-hidden rounded-md border border-border bg-card shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className={cn("px-6 py-4", index > 0 && "border-t border-border sm:border-l sm:border-t-0")}>
          <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
          <div className="mt-2 min-h-6 text-lg font-semibold text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
