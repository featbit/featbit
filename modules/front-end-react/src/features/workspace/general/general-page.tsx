import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getCurrentWorkspace } from "@/features/layout/context";
import { IdentitySettingsSection } from "./identity-settings-section";
import { SsoSettingsSection } from "./sso-settings-section";
import {
  fetchWorkspaceDetails,
  isWorkspaceKeyUsed,
  updateWorkspaceIdentity,
  updateWorkspaceOidcSettings,
  type WorkspaceDetails
} from "../workspace-api";
import { WorkspaceLayout } from "../workspace-layout";
import { SkeletonForm } from "./workspace-shell";
import type { IdentityFormValues, SsoFormValues } from "./workspace-types";
import { emptySsoValues, isSsoLicensed } from "./workspace-utils";

export function GeneralPage({ lang }: { lang: "en" | "zh" }) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState<WorkspaceDetails>(() => getCurrentWorkspace());
  const [isLoading, setIsLoading] = useState(true);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [ssoSaving, setSsoSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [canUpdateSsoSettings, setCanUpdateSsoSettings] = useState(true);
  const canUpdateGeneralSettings = true;
  const ssoLicensed = isSsoLicensed(workspace);

  const requiredMessage = t("workspace.validation.required");
  const urlMessage = t("workspace.validation.url");

  const identitySchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        key: z.string().trim().min(1, requiredMessage)
      }),
    [requiredMessage]
  );

  const ssoSchema = useMemo(
    () =>
      z.object({
        clientId: z.string().trim().min(1, requiredMessage),
        clientSecret: z.string().trim().min(1, requiredMessage),
        tokenEndpoint: z.string().trim().min(1, requiredMessage).url(urlMessage),
        clientAuthenticationMethod: z.string().trim().min(1, requiredMessage),
        authorizationEndpoint: z.string().trim().min(1, requiredMessage).url(urlMessage),
        scope: z.string().trim().min(1, requiredMessage),
        userEmailClaim: z.string().trim().min(1, requiredMessage)
      }),
    [requiredMessage, urlMessage]
  );

  const identityForm = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { name: workspace.name, key: workspace.key },
    mode: "onChange"
  });

  const ssoForm = useForm<SsoFormValues>({
    resolver: zodResolver(ssoSchema),
    defaultValues: emptySsoValues(workspace),
    mode: "onChange"
  });

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

        setWorkspace({
          ...loadedWorkspace,
          license: loadedWorkspace.license ?? currentWorkspace.license
        });
        setCanUpdateSsoSettings(loadedWorkspace.sso !== null);
      } catch (error) {
        if (!cancelled) {
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
    identityForm.reset({ name: workspace.name, key: workspace.key });
    ssoForm.reset(emptySsoValues(workspace));
  }, [identityForm, ssoForm, workspace]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function onSaveIdentity(values: IdentityFormValues) {
    if (!canUpdateGeneralSettings) {
      return;
    }

    setIdentitySaving(true);
    try {
      const trimmedValues = { name: values.name.trim(), key: values.key.trim() };
      if (trimmedValues.key !== workspace.key) {
        const keyUsed = await isWorkspaceKeyUsed(trimmedValues.key);
        if (keyUsed) {
          identityForm.setError("key", { message: t("workspace.validation.keyUsed") });
          return;
        }
      }

      const updatedWorkspace = await updateWorkspaceIdentity({ id: workspace.id, ...trimmedValues });
      setWorkspace(updatedWorkspace);
      setToastMessage(t("workspace.operationSucceeded"));
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : t("workspace.requestFailed"));
    } finally {
      setIdentitySaving(false);
    }
  }

  async function onSaveSso(values: SsoFormValues) {
    if (!canUpdateSsoSettings) {
      return;
    }

    setSsoSaving(true);
    try {
      const updatedWorkspace = await updateWorkspaceOidcSettings({ id: workspace.id, ...values });
      setWorkspace(updatedWorkspace);
      setToastMessage(t("workspace.operationSucceeded"));
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : t("workspace.requestFailed"));
    } finally {
      setSsoSaving(false);
    }
  }

  return (
    <WorkspaceLayout workspace={workspace} lang={lang} activeTab="general" statusMessage={toastMessage}>
      {isLoading ? (
        <div className="py-8">
          <SkeletonForm />
        </div>
      ) : (
        <div>
          <IdentitySettingsSection
            form={identityForm}
            canUpdate={canUpdateGeneralSettings}
            isSaving={identitySaving}
            onSubmit={onSaveIdentity}
          />

          <SsoSettingsSection
            form={ssoForm}
            isLicensed={ssoLicensed}
            canUpdate={canUpdateSsoSettings}
            isSaving={ssoSaving}
            secretVisible={secretVisible}
            setSecretVisible={setSecretVisible}
            onSubmit={onSaveSso}
          />
        </div>
      )}
    </WorkspaceLayout>
  );
}
