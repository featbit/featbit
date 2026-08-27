import { useTranslation } from "react-i18next"
import { LicenseGateCard } from "@/components/license-gate-card"

export function ChangeRequestsLicenseGate({
  manageLicenseHref,
}: {
  manageLicenseHref: string
}) {
  const { t } = useTranslation()

  return (
    <LicenseGateCard
      title={t("changeRequests.licenseGateTitle")}
      description={t("changeRequests.licenseGateDescription")}
      actionLabel={t("changeRequests.manageLicense")}
      actionHref={manageLicenseHref}
      note={t("changeRequests.licenseGateNote")}
    />
  )
}
