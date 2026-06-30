import { Building2, Check, Folder, Loader2, LogOut, SquareCode } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { InputField, TextInput } from "@/features/workspace/general/form-fields";
import { cn } from "@/lib/utils";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
};

type OnboardingFormProps = {
  organizationName: string;
  projectName: string;
  projectKey: string;
  isSubmitting: boolean;
  error: string;
  canSubmit: boolean;
  setOrganizationName: (value: string) => void;
  updateProjectName: (value: string) => void;
  updateProjectKey: (value: string) => void;
  onSubmit: () => void;
  onSignOut: () => void;
};

export function OnboardingForm({
  organizationName,
  projectName,
  projectKey,
  isSubmitting,
  error,
  canSubmit,
  setOrganizationName,
  updateProjectName,
  updateProjectKey,
  onSubmit,
  onSignOut
}: OnboardingFormProps) {
  const { t } = useTranslation();

  return (
    <main className="min-w-0">
      <header>
        <h1 className="text-[2rem] font-semibold leading-tight tracking-normal text-slate-950 dark:text-slate-50">
          {t("onboarding.title")}
        </h1>
        <p className="mt-3 text-base text-slate-500 dark:text-slate-400">{t("onboarding.subtitle")}</p>
      </header>

      <div className="mt-8 space-y-6">
        <SetupSection icon={<Building2 className="h-6 w-6" />} title={t("onboarding.organization.section")}>
          <TextField
            id="onboardingOrganizationName"
            label={t("onboarding.organization.name")}
            value={organizationName}
            placeholder={t("onboarding.organization.placeholder")}
            onChange={setOrganizationName}
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("onboarding.organization.helper")}</p>
        </SetupSection>

        <SectionDivider />

        <SetupSection icon={<Folder className="h-6 w-6" />} title={t("onboarding.project.section")}>
          <TextField
            id="onboardingProjectName"
            label={t("onboarding.project.name")}
            value={projectName}
            placeholder={t("onboarding.project.namePlaceholder")}
            onChange={updateProjectName}
          />
          <TextField
            id="onboardingProjectKey"
            label={t("onboarding.project.key")}
            value={projectKey}
            placeholder={t("onboarding.project.keyPlaceholder")}
            icon={<SquareCode className="h-4 w-4" />}
            onChange={updateProjectKey}
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("onboarding.project.helper")}</p>
        </SetupSection>

        <SectionDivider />

        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{t("onboarding.environments.section")}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <EnvironmentPill name="Dev" tone="green" />
            <EnvironmentPill name="Prod" tone="blue" />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t("onboarding.environments.helper")}</p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-6 pt-2">
          <Button
            type="button"
            className="h-12 rounded-md bg-blue-600 px-6 text-base text-white shadow-sm hover:bg-blue-700"
            disabled={!canSubmit || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("onboarding.complete")}
          </Button>
          <Button type="button" variant="ghost" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            {t("selectWorkspace.signInWithAnotherEmail")}
          </Button>
        </div>
      </div>
    </main>
  );
}

function SetupSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        <span className="text-slate-900 dark:text-slate-100">{icon}</span>
        <h2 className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SectionDivider() {
  return <div className="h-px w-full bg-slate-200 dark:bg-slate-800" />;
}

function TextField({ id, label, value, placeholder, icon, onChange }: TextFieldProps) {
  return (
    <InputField id={id} label={label}>
      {icon ? (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{icon}</span>
          <TextInput id={id} className="pl-10" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        </div>
      ) : (
        <TextInput id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </InputField>
  );
}

function EnvironmentPill({ name, tone }: { name: string; tone: "green" | "blue" }) {
  return (
    <div className="inline-flex h-11 items-center gap-3 rounded-md border border-slate-300 bg-white px-5 text-base font-semibold text-slate-950 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50">
      <span className={cn("h-3 w-3 rounded-full", tone === "green" ? "bg-emerald-600" : "bg-blue-600")} />
      {name}
    </div>
  );
}
