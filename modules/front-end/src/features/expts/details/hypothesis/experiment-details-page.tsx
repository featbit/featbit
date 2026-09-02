import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { AgentSetupDialog } from "../components/agent-setup-dialog"
import { ExperimentDetailsHeader } from "../components/experiment-details-header"
import { ExperimentSettings } from "../components/experiment-settings"
import { ExperimentStageNavigation } from "../components/experiment-stage-navigation"
import {
  experimentStageFromParam,
  experimentStageSearchParams,
} from "../experiment-stage-route"
import {
  advanceExperimentToExposure,
  deleteExperiment,
  fetchExperimentDetail,
  updateExperimentDetails,
} from "../experiment-details-api"
import type {
  ExperimentDetailsUpdate,
  ExperimentLearningUpdate,
} from "../experiment-details-types"
import { ExposureDetails } from "../exposure/exposure-details"
import { LearningDetails } from "../learning/learning-details"
import { MeasuringDetails } from "../measuring/measuring-details"
import { HypothesisDetails } from "./hypothesis-details"

function LoadingPage({ backHref }: { backHref: string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <Link
        to={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        {t("releaseDecision.experiments.title")}
      </Link>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-5 w-[460px]" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-4 gap-8 rounded-lg border px-8 py-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-6">
        <div className="mb-6 flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-[520px]" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="overflow-hidden rounded-lg border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={`grid min-h-12 grid-cols-[220px_1fr] gap-6 px-4 py-3 ${
                index ? "border-t" : ""
              }`}
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ExperimentDetailsPage() {
  const { t } = useTranslation()
  const { lang: langParam, experimentId = "" } = useParams()
  const lang = resolveLang(langParam)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const backHref = localizedPath(lang, "/experiments")
  const [settingsActive, setSettingsActive] = useState(false)
  const [agentSetupOpen, setAgentSetupOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string>()
  const queryKey = ["experiment-details", envId, experimentId]

  const detailQuery = useQuery({
    queryKey,
    queryFn: () => fetchExperimentDetail(envId, experimentId),
    enabled: Boolean(envId && experimentId),
  })

  const updateMutation = useMutation({
    mutationFn: (update: ExperimentDetailsUpdate | ExperimentLearningUpdate) =>
      updateExperimentDetails(envId, experimentId, update),
    onSuccess: (experiment, update) => {
      queryClient.setQueryData(queryKey, experiment)
      toast.success(
        t(
          "lastLearning" in update
            ? "releaseDecision.experiments.detailsPage.learning.edit.saved"
            : "releaseDecision.experiments.detailsPage.edit.saved"
        )
      )
    },
  })

  const advanceMutation = useMutation({
    mutationFn: () => advanceExperimentToExposure(envId, experimentId),
    onSuccess: (experiment) => {
      queryClient.setQueryData(queryKey, experiment)
      setSearchParams((current) =>
        experimentStageSearchParams(current, "implementing")
      )
      toast.success(t("releaseDecision.experiments.detailsPage.advanced"))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteExperiment(envId, experimentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["experiments"] })
      toast.success(
        t("releaseDecision.experiments.detailsPage.settings.deleted")
      )
      navigate(backHref)
    },
  })

  const routeStage = experimentStageFromParam(
    searchParams.get("stage") ?? undefined
  )
  const activeStage = routeStage ?? detailQuery.data?.stage ?? "hypothesis"

  useEffect(() => {
    if (!detailQuery.data || routeStage) return
    setSearchParams(
      (current) => experimentStageSearchParams(current, detailQuery.data.stage),
      { replace: true }
    )
  }, [detailQuery.data, routeStage, setSearchParams])

  return (
    <TooltipProvider>
      <main className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
        {!detailQuery.data ? (
          detailQuery.isLoading ? (
            <LoadingPage backHref={backHref} />
          ) : (
            <div className="space-y-8">
              <Link
                to={backHref}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <ChevronLeft className="size-4" />
                {t("releaseDecision.experiments.title")}
              </Link>
              <div className="flex max-w-2xl items-center justify-between gap-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">
                  {t("releaseDecision.experiments.detailsPage.loadFailed")}
                </p>
                {envId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void detailQuery.refetch()}
                  >
                    {t("releaseDecision.experiments.retry")}
                  </Button>
                ) : null}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6">
            <ExperimentDetailsHeader
              experiment={detailQuery.data}
              lang={lang}
              settingsActive={settingsActive}
              onAgentSetup={() => setAgentSetupOpen(true)}
              onSettings={() => setSettingsActive((active) => !active)}
            />

            {settingsActive ? (
              <ExperimentSettings
                experiment={detailQuery.data}
                deleting={deleteMutation.isPending}
                deleteError={deleteMutation.isError}
                onDelete={() => deleteMutation.mutate()}
              />
            ) : (
              <>
                <ExperimentStageNavigation
                  activeStage={activeStage}
                  stageHref={(stage) =>
                    `?${experimentStageSearchParams(searchParams, stage).toString()}`
                  }
                />
                {activeStage === "hypothesis" ? (
                  <HypothesisDetails
                    experiment={detailQuery.data}
                    saving={updateMutation.isPending}
                    saveError={updateMutation.isError}
                    advancing={advanceMutation.isPending}
                    advanceError={advanceMutation.isError}
                    onSave={(update) =>
                      updateMutation.mutateAsync(update).then(() => undefined)
                    }
                    onAdvance={() => advanceMutation.mutate()}
                  />
                ) : null}
                {activeStage === "implementing" ? (
                  <ExposureDetails
                    experiment={detailQuery.data}
                    envId={envId}
                    lang={lang}
                    onAdvanced={() =>
                      setSearchParams((current) =>
                        experimentStageSearchParams(current, "measuring")
                      )
                    }
                  />
                ) : null}
                {activeStage === "measuring" ? (
                  <MeasuringDetails
                    experiment={detailQuery.data}
                    envId={envId}
                    selectedRunId={selectedRunId}
                    onSelectedRunChange={setSelectedRunId}
                  />
                ) : null}
                {activeStage === "learning" ? (
                  <LearningDetails
                    experiment={detailQuery.data}
                    saving={updateMutation.isPending}
                    saveError={updateMutation.isError}
                    selectedRunId={selectedRunId}
                    onSelectedRunChange={setSelectedRunId}
                    onSave={(update) =>
                      updateMutation.mutateAsync(update).then(() => undefined)
                    }
                  />
                ) : null}
              </>
            )}

            <AgentSetupDialog
              open={agentSetupOpen}
              experiment={detailQuery.data}
              onOpenChange={setAgentSetupOpen}
            />
          </div>
        )}
      </main>
    </TooltipProvider>
  )
}
