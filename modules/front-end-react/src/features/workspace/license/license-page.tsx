import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWorkspace } from "@/features/layout/context";
import { getRuntimeEnv } from "@/lib/env/runtime-env";
import { fetchWorkspaceDetails, updateWorkspaceLicense, type WorkspaceDetails } from "../workspace-api";
import { WorkspaceLayout } from "../workspace-layout";
import { EmptyLicenseNotice } from "./empty-license-notice";
import { FeatureGrid } from "./feature-grid";
import { LicenseAccessSection } from "./license-access-section";
import { LicenseSkeleton } from "./license-skeleton";
import { getLicenseStatus, parseLicense } from "./license-utils";
import { SummaryRow } from "./summary-row";

const HOSTING_MODE_SAAS = "saas";

export function LicensePage({ lang }: { lang: "en" | "zh" }) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState<WorkspaceDetails>(() => getCurrentWorkspace());
  const [licenseValue, setLicenseValue] = useState(workspace.license ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");
  const isSaas = getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS;
  const canUpdateLicense = true;

  const license = useMemo(() => parseLicense(workspace.license), [workspace.license]);
  const status = getLicenseStatus(license);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      try {
        const currentWorkspace = getCurrentWorkspace();
        const loadedWorkspace = await fetchWorkspaceDetails();
        if (cancelled) {
          return;
        }

        const nextWorkspace = { ...loadedWorkspace, license: loadedWorkspace.license ?? currentWorkspace.license };
        setWorkspace(nextWorkspace);
        setLicenseValue(nextWorkspace.license ?? "");
      } catch (error) {
        if (!cancelled) {
          setToastVariant("error");
          setToastMessage(error instanceof Error ? error.message : t("workspace.requestFailed"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function onUpdateLicense() {
    if (!canUpdateLicense || !licenseValue.trim()) {
      return;
    }

    setIsUpdating(true);
    try {
      const updatedWorkspace = await updateWorkspaceLicense(licenseValue.trim());
      setWorkspace(updatedWorkspace);
      setLicenseValue(updatedWorkspace.license ?? licenseValue.trim());
      setToastVariant("success");
      setToastMessage(t("workspace.license.updateSucceeded"));
    } catch {
      setToastVariant("error");
      setToastMessage(t("workspace.license.invalidLicense"));
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <WorkspaceLayout workspace={workspace} lang={lang} activeTab="license" statusMessage={toastMessage} statusVariant={toastVariant}>
      {isLoading ? (
        <LicenseSkeleton />
      ) : (
        <div className="pb-8">
          {!isSaas ? (
            <LicenseAccessSection
              workspace={workspace}
              licenseValue={licenseValue}
              setLicenseValue={setLicenseValue}
              canUpdateLicense={canUpdateLicense}
              isUpdating={isUpdating}
              onCopied={() => {
                setToastVariant("success");
                setToastMessage(t("workspace.license.copied"));
              }}
              onUpdateLicense={onUpdateLicense}
            />
          ) : null}

          <section className={isSaas ? "pt-7" : "pt-7"}>
            <h2 className="text-lg font-semibold text-foreground">{t("workspace.license.licenseStatus")}</h2>
            {license ? (
              <div className="mt-3">
                <SummaryRow isSaas={isSaas} license={license} status={status} lang={lang} />
              </div>
            ) : (
              <EmptyLicenseNotice isSaas={isSaas} lang={lang} />
            )}
          </section>

          <FeatureGrid license={license} status={status} />
        </div>
      )}
    </WorkspaceLayout>
  );
}
