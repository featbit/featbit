import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { signOut } from "@/features/auth/auth-api";
import { AuthHeader } from "@/features/auth/auth-header";
import { getCurrentOrganization, localizedPath, persistCurrentOrganization, resolveLang } from "@/features/layout/context";
import { completeOnboarding } from "./onboarding-api";
import { OnboardingForm } from "./onboarding-form";
import { slugify } from "./onboarding-utils";
import { CreationPreview } from "./creation-preview";

const defaultEnvironments = ["Dev", "Prod"];

export function OnboardingPage() {
  const { t } = useTranslation();
  const params = useParams();
  const lang = resolveLang(params.lang);
  const navigate = useNavigate();
  const currentOrganization = getCurrentOrganization();
  const [organizationName, setOrganizationName] = useState(currentOrganization.name);
  const [projectName, setProjectName] = useState("Example project");
  const [projectKey, setProjectKey] = useState("example-project");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (currentOrganization.initialized !== false) {
      navigate(localizedPath(lang, "/feature-flags"), { replace: true });
    }
  }, [currentOrganization.initialized, lang, navigate]);

  const organizationKey = useMemo(() => slugify(organizationName), [organizationName]);
  const canSubmit = Boolean(organizationName.trim() && organizationKey && projectName.trim() && projectKey.trim());

  function updateProjectName(value: string) {
    setProjectName(value);
    setProjectKey(slugify(value));
  }

  async function submit() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await completeOnboarding({
        organizationName: organizationName.trim(),
        organizationKey,
        projectName: projectName.trim(),
        projectKey: projectKey.trim(),
        environments: defaultEnvironments
      });

      persistCurrentOrganization({
        ...currentOrganization,
        initialized: true,
        name: organizationName.trim(),
        key: organizationKey
      });

      if (!localStorage.getItem("get-started")) {
        navigate(`${localizedPath(lang, "/get-started")}?status=init`, { replace: true });
        return;
      }

      navigate(`${localizedPath(lang, "/feature-flags")}?status=init`, { replace: true });
    } catch {
      setError(t("onboarding.errors.submit"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSignOut() {
    signOut();
    navigate(localizedPath(lang, "/login"), { replace: true });
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <AuthHeader lang={lang} />
      <section className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 px-4 py-3">
        <div className="w-full max-w-[90rem] rounded-md border border-border bg-card py-6 px-9 shadow-sm">
          <div className="grid items-stretch gap-16 xl:grid-cols-[minmax(38rem,45rem)_minmax(30rem,36rem)]">
            <OnboardingForm
              organizationName={organizationName}
              projectName={projectName}
              projectKey={projectKey}
              isSubmitting={isSubmitting}
              error={error}
              canSubmit={canSubmit}
              setOrganizationName={setOrganizationName}
              updateProjectName={updateProjectName}
              updateProjectKey={(value) => setProjectKey(slugify(value))}
              onSubmit={() => void submit()}
              onSignOut={handleSignOut}
            />

            <CreationPreview
              organizationName={organizationName || t("onboarding.preview.organizationFallback")}
              projectName={projectName || t("onboarding.preview.projectFallback")}
              projectKey={projectKey || "example-project"}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
