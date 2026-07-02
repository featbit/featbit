import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { localizedPath, type Lang } from "@/features/layout/context";

export function EmptyLicenseNotice({ isSaas, lang }: { isSaas: boolean; lang: Lang }) {
  const { t } = useTranslation();

  return (
    <Alert className="mt-4 flex gap-3 border-blue-200 bg-blue-50 text-sm text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
      <div>
        <AlertTitle className="mb-0 font-semibold">{t("workspace.license.noLicense")}</AlertTitle>
        <AlertDescription className="mt-1 text-blue-900/80 dark:text-blue-100/80">
          {isSaas ? (
            <>
              {t("workspace.license.noLicenseSaasDescription")}{" "}
              <Link className="font-medium underline underline-offset-4" to={localizedPath(lang, "/workspace/billing")}>
                {t("workspace.license.openBilling")}
              </Link>
            </>
          ) : (
            <>
              {t("workspace.license.noLicenseDescription")}{" "}
              <a className="font-medium underline underline-offset-4" href="https://www.featbit.co/pricing" target="_blank" rel="noreferrer">
                https://www.featbit.co/pricing
              </a>
            </>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}
