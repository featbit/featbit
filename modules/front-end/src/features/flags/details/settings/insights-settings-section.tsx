import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchRunningExperiments,
  updateFeatureFlagInsightCollection,
} from "../../flags-api"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import { InsightCollectionDialog } from "./insight-collection-dialog"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { FeatureFlag } from "../../flags-types"

export function InsightsSettingsSection({
  flag,
  envId,
  requireComment,
  onSaved,
}: {
  flag: FeatureFlag
  envId: string
  requireComment: boolean
  onSaved: (flag: FeatureFlag) => void
}) {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const [reviewOpen, setReviewOpen] = useState(false)
  const enabled = flag.insightsEnabled !== false
  const queryClient = useQueryClient()
  const queryKey = ["flag-running-experiments", envId, flag.key]
  const running = useQuery({
    queryKey,
    queryFn: () => fetchRunningExperiments(envId, flag.key),
  })
  const experiments = running.data ?? []
  const linked = experiments.length > 0
  const locked = enabled && (linked || running.isPending || running.isError)
  const mutation = useMutation({
    mutationFn: (comment: string) =>
      updateFeatureFlagInsightCollection(envId, flag.key, !enabled, comment),
    onSuccess: (revision) => {
      onSaved({ ...flag, insightsEnabled: !enabled, revision })
      setReviewOpen(false)
      toast.success(t("featureFlags.operationSucceeded"))
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
      void queryClient.invalidateQueries({ queryKey: ["flag-audit-logs"] })
      void queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      if (
        error instanceof ApiRequestError &&
        error.errors.includes("BusinessRuleViolation")
      ) {
        setReviewOpen(false)
        void queryClient.invalidateQueries({ queryKey })
        toast.error(t("featureFlags.detailsPage.settings.insightsBlocked"))
      } else {
        toast.error(
          t(
            error instanceof ApiRequestError && error.status === 403
              ? "featureFlags.permissionDenied"
              : "featureFlags.operationFailed"
          )
        )
      }
    },
  })

  return (
    <section className="max-w-3xl space-y-5 border-t pt-6">
      <h2 className="text-base font-medium">
        {t("featureFlags.detailsPage.tabs.insights")}
      </h2>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {t("featureFlags.detailsPage.settings.insightCollection")}
            </p>
            <Badge variant="secondary">
              {t(
                `featureFlags.detailsPage.settings.insightsValue.${enabled ? "enabled" : "disabled"}`
              )}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("featureFlags.detailsPage.settings.insightCollectionHelp")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(flag.isArchived) || locked || mutation.isPending}
          onClick={() => setReviewOpen(true)}
        >
          {t(
            `featureFlags.detailsPage.settings.${enabled ? "disableInsights" : "enableInsights"}`
          )}
        </Button>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-medium">
          {t("featureFlags.detailsPage.settings.runningExperiments")}
        </h3>
        {running.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t("featureFlags.loading")}
          </p>
        ) : running.isError ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">
              {t("featureFlags.detailsPage.settings.experimentsLoadFailed")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void running.refetch()}
            >
              {t("featureFlags.retry")}
            </Button>
          </div>
        ) : linked ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("featureFlags.detailsPage.settings.runningExperimentsHelp")}
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {experiments.map(({ id, name }) => (
                <li key={id}>
                  <Link
                    to={localizedPath(
                      lang,
                      `/experiments/${encodeURIComponent(id)}`
                    )}
                    className="rounded-sm text-sm text-primary underline underline-offset-4 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("featureFlags.detailsPage.settings.noRunningExperiments")}
          </p>
        )}
      </div>
      {reviewOpen ? (
        <InsightCollectionDialog
          enabled={!enabled}
          flagName={flag.name}
          requireComment={requireComment}
          saving={mutation.isPending}
          onClose={() => setReviewOpen(false)}
          onConfirm={(comment) => mutation.mutate(comment)}
        />
      ) : null}
    </section>
  )
}
