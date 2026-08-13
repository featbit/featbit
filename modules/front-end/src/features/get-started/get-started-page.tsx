import { useQuery } from "@tanstack/react-query"
import { CircleAlert } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { ConnectSdkStep } from "./components/connect-sdk-step"
import { CreateFeatureFlagStep } from "./components/create-feature-flag-step"
import { GetStartedProgress } from "./components/get-started-progress"
import { ResourcesRail } from "./components/resources-rail"
import { VerifyConnectionStep } from "./components/verify-connection-step"
import { fetchGetStartedEnvironment } from "./get-started-api"
import { markGetStartedVisited } from "./get-started-state"
import type { GetStartedFlag, GetStartedStep, SdkId } from "./get-started-types"

export function GetStartedPage() {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const navigate = useNavigate()
  const projectEnv = getCurrentProjectEnv()
  const [step, setStep] = useState<GetStartedStep>(0)
  const [flag, setFlag] = useState<GetStartedFlag | null>(null)
  const [sdkId, setSdkId] = useState<SdkId>("javascript")
  const [selectedSecretId, setSelectedSecretId] = useState("")
  const pageRef = useRef<HTMLDivElement>(null)
  const previousStepRef = useRef<GetStartedStep>(step)
  const environmentQuery = useQuery({
    queryKey: [
      "get-started",
      "environment",
      projectEnv?.projectId ?? "",
      projectEnv?.envId ?? "",
    ],
    queryFn: () =>
      fetchGetStartedEnvironment(projectEnv!.projectId, projectEnv!.envId),
    enabled: Boolean(projectEnv?.projectId && projectEnv.envId),
    staleTime: 60_000,
  })

  useEffect(() => {
    markGetStartedVisited()
  }, [])

  useLayoutEffect(() => {
    if (previousStepRef.current === step) return
    previousStepRef.current = step

    const page = pageRef.current
    const scrollContainer = page?.closest("main")
    if (scrollContainer) scrollContainer.scrollTop = 0

    page
      ?.querySelector<HTMLElement>("[data-get-started-step-heading]")
      ?.focus({ preventScroll: true })
  }, [step])

  function exitToFeatureFlags() {
    navigate(localizedPath(lang, "/feature-flags"))
  }

  return (
    <div
      ref={pageRef}
      className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8"
    >
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("getStarted.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("getStarted.subtitle")}
        </p>
      </header>

      <div className="@container space-y-5">
        <GetStartedProgress
          step={step}
          flag={flag}
          sdkId={sdkId}
          onStepChange={setStep}
        />

        {!projectEnv ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{t("getStarted.noEnvironment.title")}</AlertTitle>
            <AlertDescription>
              {t("getStarted.noEnvironment.description")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid items-start gap-5 @min-[70rem]:grid-cols-[minmax(0,1fr)_18rem]">
            {step === 0 ? (
              <CreateFeatureFlagStep
                value={flag}
                onComplete={(nextFlag) => {
                  setFlag(nextFlag)
                  setStep(1)
                }}
              />
            ) : null}

            {step === 1 && flag ? (
              <ConnectSdkStep
                lang={lang}
                flag={flag}
                sdkId={sdkId}
                environment={environmentQuery.data}
                environmentLoading={environmentQuery.isLoading}
                environmentError={environmentQuery.isError}
                selectedSecretId={selectedSecretId}
                onSdkChange={setSdkId}
                onSecretChange={setSelectedSecretId}
                onRetryEnvironment={() => void environmentQuery.refetch()}
                onBack={() => setStep(0)}
                onContinue={() => setStep(2)}
              />
            ) : null}

            {step === 2 && flag ? (
              <VerifyConnectionStep
                envId={projectEnv.envId}
                flag={flag}
                sdkId={sdkId}
                onBack={() => setStep(1)}
                onExit={exitToFeatureFlags}
              />
            ) : null}

            <ResourcesRail environment={environmentQuery.data} />
          </div>
        )}
      </div>
    </div>
  )
}
