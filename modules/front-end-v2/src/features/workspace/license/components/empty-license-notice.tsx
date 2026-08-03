import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"

export function EmptyLicenseNotice({
  isSaas,
  lang,
}: {
  isSaas: boolean
  lang: Lang
}) {
  const { t } = useTranslation()

  return (
    <Alert className="mt-4">
      <Info className="size-4" />
      <AlertTitle>{t("workspace.license.noLicense")}</AlertTitle>
      <AlertDescription>
        {isSaas ? (
          <>
            {t("workspace.license.noLicenseSaasDescription")}{" "}
            <Link
              className="font-medium underline underline-offset-4"
              to={localizedPath(lang, "/workspace/billing")}
            >
              {t("workspace.license.openBilling")}
            </Link>
          </>
        ) : (
          t("workspace.license.noLicenseDescription")
        )}
      </AlertDescription>
    </Alert>
  )
}
