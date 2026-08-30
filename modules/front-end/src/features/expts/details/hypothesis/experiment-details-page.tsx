import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
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
  advanceExperimentToExposure,
  deleteExperiment,
  fetchExperimentDetail,
  updateExperimentDetails,
} from "../experiment-details-api"
import type {
  ExperimentDetail,
  ExperimentDetailsUpdate,
} from "../experiment-details-types"
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
              className={`grid min-h-16 grid-cols-[220px_1fr] gap-6 px-4 py-4 ${
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
  const queryClient = useQueryClient()
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const backHref = localizedPath(lang, "/experiments")
  const [settingsActive, setSettingsActive] = useState(false)
  const [agentSetupOpen, setAgentSetupOpen] = useState(false)
  const [stageSelection, setStageSelection] = useState<{
    experimentId: string
    stage: ExperimentDetail["stage"]
  } | null>(null)
  const queryKey = ["experiment-details", envId, experimentId]

  const detailQuery = useQuery({
    queryKey,
    queryFn: () => fetchExperimentDetail(envId, experimentId),
    enabled: Boolean(envId && experimentId),
  })

  const updateMutation = useMutation({
    mutationFn: (update: ExperimentDetailsUpdate) =>
      updateExperimentDetails(envId, experimentId, update),
    onSuccess: (experiment) => {
      queryClient.setQueryData(queryKey, experiment)
      toast.success(t("releaseDecision.experiments.detailsPage.edit.saved"))
    },
  })

  const advanceMutation = useMutation({
    mutationFn: () => advanceExperimentToExposure(envId, experimentId),
    onSuccess: (experiment) => {
      queryClient.setQueryData(queryKey, experiment)
      setStageSelection({ experimentId, stage: "implementing" })
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

  const activeStage =
    stageSelection?.experimentId === experimentId
      ? stageSelection.stage
      : (detailQuery.data?.stage ?? "hypothesis")

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
                onBack={() => setSettingsActive(false)}
                onDelete={() => deleteMutation.mutate()}
              />
            ) : (
              <>
                <ExperimentStageNavigation
                  activeStage={activeStage}
                  onStageSelect={(stage) =>
                    setStageSelection({ experimentId, stage })
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
