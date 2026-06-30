import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { localizedPath, type Lang } from "@/features/layout/context";

export function EmptyLicenseNotice({ isSaas, lang }: { isSaas: boolean; lang: Lang }) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 flex gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
      <div>
        <div className="font-semibold">{t("workspace.license.noLicense")}</div>
        <p className="mt-1 text-blue-900/80 dark:text-blue-100/80">
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
        </p>
      </div>
    </div>
  );
}
