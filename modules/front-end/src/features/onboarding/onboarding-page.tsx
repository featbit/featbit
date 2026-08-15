import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { getStoredUserProfile, signOut } from "@/features/auth/auth-api"
import { AuthHeader } from "@/features/auth/components/auth-header"
import { getAuthenticatedLandingPath } from "@/features/get-started/get-started-state"
import { authContextQueryKeys } from "@/features/layout/auth-context-query"
import {
  chooseProjectEnv,
  fetchProjects,
  getCurrentOrganization,
  localizedPath,
  persistCurrentOrganization,
  resolveLang,
  saveCurrentProjectEnv,
} from "@/features/layout/layout-context"
import {
  completeOnboarding,
  createExampleProject,
} from "@/features/onboarding/onboarding-api"
import { CreationPreview } from "@/features/onboarding/components/creation-preview"
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form"
import { slugify } from "@/features/onboarding/onboarding-utils"

const defaultEnvironments = ["Dev", "Prod"]

export function OnboardingPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const isExampleProjectRecovery =
    searchParams.get("mode") === "create-example-project"
  const currentOrganization = getCurrentOrganization()
  const currentOrganizationId = currentOrganization?.id ?? ""
  const completedHereRef = useRef(false)
  const [organizationName, setOrganizationName] = useState(
    currentOrganization?.name ?? ""
  )
  const [projectName, setProjectName] = useState("Example project")
  const [projectKey, setProjectKey] = useState("example-project")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (
      !isExampleProjectRecovery &&
      !completedHereRef.current &&
      currentOrganization?.initialized !== false
    ) {
      navigate(localizedPath(lang, getAuthenticatedLandingPath()), {
        replace: true,
      })
    }
  }, [
    currentOrganization?.initialized,
    isExampleProjectRecovery,
    lang,
    navigate,
  ])

  useEffect(() => {
    if (!isExampleProjectRecovery || !currentOrganizationId) {
      return
    }

    let cancelled = false

    async function enterExistingProject() {
      const projects = await fetchProjects().catch(() => [])
      const projectEnv = chooseProjectEnv(projects)
      if (cancelled || !projectEnv) {
        return
      }

      saveCurrentProjectEnv(projectEnv)
      queryClient.removeQueries({
        queryKey: authContextQueryKeys.projects(
          getStoredUserProfile().id ?? "",
          currentOrganizationId
        ),
        exact: true,
      })
      navigate(localizedPath(lang, getAuthenticatedLandingPath()), {
        replace: true,
      })
    }

    void enterExistingProject()

    return () => {
      cancelled = true
    }
  }, [
    currentOrganizationId,
    isExampleProjectRecovery,
    lang,
    navigate,
    queryClient,
  ])

  const organizationKey = useMemo(
    () => slugify(organizationName),
    [organizationName]
  )
  const canSubmit = Boolean(
    (isExampleProjectRecovery ||
      (organizationName.trim() && organizationKey)) &&
    projectName.trim() &&
    projectKey.trim()
  )

  function updateProjectName(value: string) {
    setProjectName(value)
    setProjectKey(slugify(value))
  }

  async function submit() {
    if (!canSubmit || isSubmitting) {
      return
    }

    if (!currentOrganization) {
      return
    }

    setError("")
    setIsSubmitting(true)

    try {
      if (isExampleProjectRecovery) {
        const project = await createExampleProject({
          name: projectName.trim(),
          key: projectKey.trim(),
        })
        const environment =
          project.environments.find(
            (item) => item.key.toLowerCase() === "dev"
          ) ?? project.environments[0]

        if (!environment) {
          throw new Error("Example project did not include an environment")
        }

        saveCurrentProjectEnv({
          projectId: project.id,
          projectName: project.name,
          projectKey: project.key,
          envId: environment.id,
          envName: environment.name,
          envKey: environment.key,
        })
        queryClient.removeQueries({
          queryKey: authContextQueryKeys.projects(
            getStoredUserProfile().id ?? "",
            currentOrganization.id
          ),
          exact: true,
        })
      } else {
        await completeOnboarding({
          organizationName: organizationName.trim(),
          organizationKey,
          projectName: projectName.trim(),
          projectKey: projectKey.trim(),
          environments: defaultEnvironments,
        })

        persistCurrentOrganization({
          ...currentOrganization,
          initialized: true,
          name: organizationName.trim(),
          key: organizationKey,
        })
        saveCurrentProjectEnv({
          projectId: projectKey.trim(),
          projectName: projectName.trim(),
          projectKey: projectKey.trim(),
          envId: "dev",
          envName: "Dev",
          envKey: "dev",
        })
      }

      completedHereRef.current = true
      const landingPath = getAuthenticatedLandingPath()

      navigate(`${localizedPath(lang, landingPath)}?status=init`, {
        replace: true,
      })
    } catch {
      setError(t("onboarding.errors.submit"))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSignOut() {
    signOut()
    navigate(localizedPath(lang, "/login"), { replace: true })
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <AuthHeader lang={lang} />
      <section className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 px-4 py-3">
        <div className="w-full max-w-[90rem] rounded-lg border bg-card px-9 py-6 shadow-sm">
          <div className="grid items-stretch gap-16 xl:grid-cols-[minmax(38rem,45rem)_minmax(30rem,36rem)]">
            <OnboardingForm
              isExampleProjectRecovery={isExampleProjectRecovery}
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
              organizationName={
                organizationName || t("onboarding.preview.organizationFallback")
              }
              projectName={
                projectName || t("onboarding.preview.projectFallback")
              }
              projectKey={projectKey || "example-project"}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
