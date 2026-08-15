import {
  Box,
  Building2,
  Check,
  Folder,
  Loader2,
  LogOut,
  SquareCode,
} from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type TextFieldProps = {
  id: string
  label: string
  value: string
  placeholder: string
  icon?: ReactNode
  onChange: (value: string) => void
}

type OnboardingFormProps = {
  projectRecoveryMode?: "example" | "no-access"
  organizationName: string
  projectName: string
  projectKey: string
  isSubmitting: boolean
  error: string
  canSubmit: boolean
  setOrganizationName: (value: string) => void
  updateProjectName: (value: string) => void
  updateProjectKey: (value: string) => void
  onSubmit: () => void
  onSignOut: () => void
}

export function OnboardingForm({
  projectRecoveryMode,
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
  onSignOut,
}: OnboardingFormProps) {
  const { t } = useTranslation()
  const isProjectRecovery = Boolean(projectRecoveryMode)
  const recoveryCopyKey =
    projectRecoveryMode === "no-access"
      ? "onboarding.noAccessibleProjects"
      : "onboarding.recovery"

  return (
    <main className="min-w-0">
      <header>
        <h1 className="text-3xl font-semibold tracking-normal">
          {t(
            isProjectRecovery ? `${recoveryCopyKey}.title` : "onboarding.title"
          )}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          {t(
            isProjectRecovery
              ? `${recoveryCopyKey}.subtitle`
              : "onboarding.subtitle"
          )}
        </p>
      </header>

      <div className="mt-8 space-y-6">
        {!isProjectRecovery ? (
          <>
            <SetupSection
              icon={<Building2 className="size-6" />}
              title={t("onboarding.organization.section")}
            >
              <TextField
                id="onboardingOrganizationName"
                label={t("onboarding.organization.name")}
                value={organizationName}
                placeholder={t("onboarding.organization.placeholder")}
                onChange={setOrganizationName}
              />
              <p className="text-sm text-muted-foreground">
                {t("onboarding.organization.helper")}
              </p>
            </SetupSection>

            <SectionDivider />
          </>
        ) : null}

        <SetupSection
          icon={<Folder className="size-6" />}
          title={t("onboarding.project.section")}
        >
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
            icon={<SquareCode className="size-4" />}
            onChange={updateProjectKey}
          />
          <p className="text-sm text-muted-foreground">
            {t("onboarding.project.helper")}
          </p>
        </SetupSection>

        <SectionDivider />

        <SetupSection
          icon={<Box className="size-6" />}
          title={t("onboarding.environments.section")}
        >
          <div className="flex flex-wrap gap-3">
            <EnvironmentPill name="Dev" tone="green" />
            <EnvironmentPill name="Prod" tone="blue" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              projectRecoveryMode === "no-access"
                ? "onboarding.noAccessibleProjects.environmentsHelper"
                : "onboarding.environments.helper"
            )}
          </p>
        </SetupSection>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-6 pt-2">
          <Button
            type="button"
            size="lg"
            disabled={!canSubmit || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t(
              isProjectRecovery
                ? `${recoveryCopyKey}.complete`
                : "onboarding.complete"
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onSignOut}>
            <LogOut className="size-4" />
            {t("selectWorkspace.signInWithAnotherEmail")}
          </Button>
        </div>
      </div>
    </main>
  )
}

function SetupSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        <span className="text-foreground">{icon}</span>
        <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function SectionDivider() {
  return <div className="h-px w-full bg-border" />
}

function TextField({
  id,
  label,
  value,
  placeholder,
  icon,
  onChange,
}: TextFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {icon ? (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            {icon}
          </span>
          <Input
            id={id}
            className="h-10 pl-10"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : (
        <Input
          id={id}
          className="h-10"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}

function EnvironmentPill({
  name,
  tone,
}: {
  name: string
  tone: "green" | "blue"
}) {
  return (
    <div className="inline-flex h-11 items-center gap-3 rounded-md border bg-card px-5 text-base font-semibold shadow-sm">
      <Box
        className={cn(
          "size-4",
          tone === "green" ? "text-emerald-600" : "text-blue-600"
        )}
      />
      {name}
    </div>
  )
}
