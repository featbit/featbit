import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  getCurrentOrganization,
  getCurrentProjectEnv,
  getCurrentWorkspace,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  fetchCurrentEnvironmentSettings,
  fetchCurrentUserPolicies,
  fetchSegment,
  fetchSegmentFlagReferences,
  fetchSegmentUserProperties,
  fetchSegmentUsersByKeyIds,
} from "../segments-api"
import {
  canUseSegmentAction,
  environmentRn,
  segmentRn,
  type SegmentAction,
} from "../segments-permissions"
import type { Segment } from "../segments-types"
import { SegmentDetailsHeader } from "./components/segment-details-header"
import { HistoryTab } from "./history/history-tab"
import { SettingsTab } from "./settings/settings-tab"
import { TargetingTab } from "./targeting/targeting-tab"

const tabs = new Set(["targeting", "settings", "history"])
type DetailsTab = "targeting" | "settings" | "history"

export function SegmentDetailsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const lang = resolveLang(params.lang)
  const segmentId = decodeURIComponent(params.segmentId ?? "")
  const requestedTab = params.tab
  const activeTab = (
    requestedTab && tabs.has(requestedTab) ? requestedTab : "targeting"
  ) as DetailsTab
  const workspace = getCurrentWorkspace()
  const organization = getCurrentOrganization()
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const segmentsPath = localizedPath(lang, "/segments")
  const envRn = environmentRn({
    organizationKey: organization?.key ?? "",
    projectKey: projectEnv?.projectKey ?? "",
    environmentKey: projectEnv?.envKey ?? "",
  })

  useEffect(() => {
    if (requestedTab !== activeTab && segmentId) {
      navigate(`${segmentsPath}/${encodeURIComponent(segmentId)}/targeting`, {
        replace: true,
      })
    }
  }, [activeTab, navigate, requestedTab, segmentId, segmentsPath])

  const segmentQuery = useQuery({
    queryKey: ["segment-details", envId, segmentId],
    queryFn: () => fetchSegment(envId, segmentId),
    enabled: Boolean(envId && segmentId),
  })
  const [savedSegment, setSavedSegment] = useState<{
    id: string
    value: Segment
  } | null>(null)
  const segment =
    savedSegment?.id === segmentId
      ? savedSegment.value
      : (segmentQuery.data ?? null)

  const referencesQuery = useQuery({
    queryKey: ["segment-references", envId, segmentId],
    queryFn: () => fetchSegmentFlagReferences(envId, segmentId),
    enabled: Boolean(envId && segmentId),
  })
  const propertiesQuery = useQuery({
    queryKey: ["segment-user-properties", envId],
    queryFn: () => fetchSegmentUserProperties(envId),
    enabled: Boolean(envId && activeTab === "targeting"),
    staleTime: 60_000,
  })
  const usersQuery = useQuery({
    queryKey: [
      "segment-selected-users",
      envId,
      segment?.included,
      segment?.excluded,
    ],
    queryFn: () =>
      fetchSegmentUsersByKeyIds(envId, [
        ...(segment?.included ?? []),
        ...(segment?.excluded ?? []),
      ]),
    enabled: Boolean(
      envId && segment && segment.included.length + segment.excluded.length
    ),
  })
  const permissionsQuery = useQuery({
    queryKey: ["segment-user-policies", workspace?.id ?? ""],
    queryFn: fetchCurrentUserPolicies,
    staleTime: 5 * 60_000,
  })
  const settingsQuery = useQuery({
    queryKey: ["segment-environment-settings", envId],
    queryFn: () => fetchCurrentEnvironmentSettings(envId),
    enabled: Boolean(envId),
    staleTime: 5 * 60_000,
  })

  const users = useMemo(
    () =>
      new Map(
        (usersQuery.data ?? []).map((user) => [user.keyId, user] as const)
      ),
    [usersQuery.data]
  )

  function can(action: SegmentAction) {
    return Boolean(
      segment &&
      permissionsQuery.isSuccess &&
      canUseSegmentAction(
        permissionsQuery.data,
        segmentRn(envRn, segment),
        action
      )
    )
  }

  function onSaved(updated: Segment) {
    setSavedSegment({ id: segmentId, value: updated })
    queryClient.setQueryData(["segment-details", envId, segmentId], updated)
    void queryClient.invalidateQueries({ queryKey: ["segments"] })
  }

  if (!envId || !segmentId || segmentQuery.isError) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("segments.detailsPage.loadFailed")}
          </p>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(segmentsPath)}
            >
              {t("segments.detailsPage.backToSegments")}
            </Button>
            {envId && segmentId ? (
              <Button type="button" onClick={() => void segmentQuery.refetch()}>
                {t("segments.retry")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (!segment || permissionsQuery.isLoading) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Skeleton className="mb-5 h-5 w-24" />
        <Skeleton className="mb-5 h-9 w-80" />
        <Skeleton className="mb-7 h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <SegmentDetailsHeader
          segment={segment}
          references={referencesQuery.data ?? []}
          activeTab={activeTab}
          basePath={segmentsPath}
          envId={envId}
          lang={lang}
        />
        {activeTab === "targeting" ? (
          propertiesQuery.isLoading || usersQuery.isLoading ? (
            <Skeleton className="mt-5 h-[34rem] w-full" />
          ) : (
            <TargetingTab
              envId={envId}
              segment={segment}
              users={users}
              properties={propertiesQuery.data ?? []}
              requireComment={settingsQuery.data?.requireChangeComment ?? false}
              canUpdateUsers={can("UpdateSegmentTargetingUsers")}
              canUpdateRules={can("UpdateSegmentRules")}
              onSaved={onSaved}
            />
          )
        ) : null}
        {activeTab === "settings" ? (
          <SettingsTab
            envId={envId}
            segment={segment}
            requireComment={settingsQuery.data?.requireChangeComment ?? false}
            canUpdateName={can("UpdateSegmentName")}
            canUpdateDescription={can("UpdateSegmentDescription")}
            canUpdateTags={can("UpdateSegmentTags")}
            canArchive={can("ArchiveSegment")}
            canRestore={can("RestoreSegment")}
            canDelete={can("DeleteSegment")}
            onSaved={onSaved}
            onRemoved={() => navigate(segmentsPath)}
          />
        ) : null}
        {activeTab === "history" ? (
          <HistoryTab envId={envId} segment={segment} />
        ) : null}
      </div>
    </TooltipProvider>
  )
}
