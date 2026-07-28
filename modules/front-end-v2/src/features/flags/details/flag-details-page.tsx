import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import {
  getCurrentProjectEnv,
  getCurrentWorkspace,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  fetchSegmentUserProperties,
  fetchSegmentUsersByKeyIds,
} from "@/features/segments/segments-api"
import type { SegmentEndUser } from "@/features/segments/segments-types"
import {
  getLicenseStatus,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import {
  createFlagChangeRequest,
  createFlagSchedule,
  fetchFeatureFlag,
  fetchFlagEnvironmentSettings,
  fetchFlagPolicies,
  fetchPendingFlagChanges,
  removePendingFlagChange,
  updateFlagChangeRequest,
  toggleFeatureFlag,
  updateFeatureFlagTargeting,
  updateFeatureFlagVariations,
} from "../flags-api"
import {
  canUseFlagAction,
  environmentRn,
  featureFlagRn,
  type FlagAction,
} from "../flags-permissions"
import type { FeatureFlag, PendingFlagChange } from "../flags-types"
import {
  FlagConfirmDialog,
  type FlagConfirmation,
} from "../index/components/flag-confirm-dialog"
import { FlagChangeReviewDialog } from "./flag-change-review-dialog"
import { FlagDetailsHeader } from "./flag-details-header"
import { HistoryTab } from "./history/history-tab"
import { InsightsTab } from "./insights/insights-tab"
import { SettingsTab } from "./settings/settings-tab"
import { PendingChangesSheet } from "./targeting/pending-changes-sheet"
import { TargetingTab } from "./targeting/targeting-tab"
import {
  TargetingSubmissionDialog,
  type TargetingSubmission,
} from "./targeting/targeting-submission-dialog"
import {
  cloneFlag,
  stableFlagTargeting,
  targetingOf,
  targetingReviewChanges,
} from "./targeting/targeting-utils"
import { TriggersTab } from "./triggers/triggers-tab"
import { VariationsReviewDialog } from "./variations/variations-review-dialog"
import { VariationsTab } from "./variations/variations-tab"
import {
  stableVariations,
  variationReviewChanges,
} from "./variations/variations-utils"

export function FlagDetailsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const lang = resolveLang(params.lang)
  const flagKey = decodeURIComponent(params.flagKey ?? "")
  const activeTab =
    params.tab === "history" ||
    params.tab === "insights" ||
    params.tab === "settings" ||
    params.tab === "variations" ||
    params.tab === "triggers"
      ? params.tab
      : "targeting"
  const projectEnv = getCurrentProjectEnv()
  const workspace = getCurrentWorkspace()
  const envId = projectEnv?.envId ?? ""
  const basePath = localizedPath(lang, "/feature-flags")
  const [draft, setDraft] = useState<{
    key: string
    value: FeatureFlag
  } | null>(null)
  const [resolvedUsers, setResolvedUsers] = useState<
    Map<string, SegmentEndUser>
  >(new Map())
  const [reviewOpen, setReviewOpen] = useState(false)
  const [variationsReviewOpen, setVariationsReviewOpen] = useState(false)
  const [reviewInitialComment, setReviewInitialComment] = useState("")
  const [pendingOpen, setPendingOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<FlagConfirmation>(null)
  const [submission, setSubmission] = useState<{
    mode: "schedule" | "change-request"
    initialReason: string
  } | null>(null)

  const flagQuery = useQuery({
    queryKey: ["feature-flag-details", envId, flagKey],
    queryFn: () => fetchFeatureFlag(envId, flagKey),
    enabled: Boolean(envId && flagKey),
  })
  const saved = flagQuery.data ?? null
  const flag = draft?.key === flagKey ? draft.value : saved
  const selectedKeys = useMemo(
    () => (saved?.targetUsers ?? []).flatMap((item) => item.keyIds),
    [saved?.targetUsers]
  )
  const usersQuery = useQuery({
    queryKey: ["flag-selected-users", envId, selectedKeys],
    queryFn: () => fetchSegmentUsersByKeyIds(envId, selectedKeys),
    enabled: Boolean(activeTab === "targeting" && envId && selectedKeys.length),
  })
  const propertiesQuery = useQuery({
    queryKey: ["flag-user-properties", envId],
    queryFn: () => fetchSegmentUserProperties(envId),
    enabled: Boolean(activeTab === "targeting" && envId),
    staleTime: 60_000,
  })
  const pendingQuery = useQuery({
    queryKey: ["flag-pending-changes", envId, flagKey],
    queryFn: () => fetchPendingFlagChanges(envId, flagKey),
    enabled: Boolean(activeTab === "targeting" && envId && flagKey),
  })
  const policiesQuery = useQuery({
    queryKey: ["feature-flag-policies", workspace?.id ?? ""],
    queryFn: fetchFlagPolicies,
    enabled:
      activeTab === "targeting" ||
      activeTab === "settings" ||
      activeTab === "variations",
    staleTime: 5 * 60_000,
  })
  const settingsQuery = useQuery({
    queryKey: ["feature-flag-environment-settings", envId],
    queryFn: () => fetchFlagEnvironmentSettings(envId),
    enabled: Boolean(
      (activeTab === "targeting" ||
        activeTab === "settings" ||
        activeTab === "variations") &&
      envId
    ),
    staleTime: 5 * 60_000,
  })

  const users = useMemo(() => {
    const map = new Map(resolvedUsers)
    for (const user of usersQuery.data ?? []) map.set(user.keyId, user)
    return map
  }, [resolvedUsers, usersQuery.data])
  const resourceRn = flag
    ? featureFlagRn(
        environmentRn({
          projectKey: projectEnv?.projectKey ?? "",
          environmentKey: projectEnv?.envKey ?? "",
        }),
        flag
      )
    : ""
  function can(action: FlagAction) {
    return Boolean(
      flag &&
      policiesQuery.isSuccess &&
      canUseFlagAction(policiesQuery.data, resourceRn, action)
    )
  }
  const dirty = Boolean(
    saved && flag && stableFlagTargeting(saved) !== stableFlagTargeting(flag)
  )
  const variationsDirty = Boolean(
    saved &&
    flag &&
    stableVariations(saved.variations) !== stableVariations(flag.variations)
  )
  const savedOffVariation = saved?.variations?.find(
    (variation) => variation.id === saved.disabledVariationId
  )
  const savedOffVariationLabel =
    savedOffVariation?.name || savedOffVariation?.value || undefined
  const changes = useMemo(
    () =>
      saved && flag
        ? targetingReviewChanges(saved, flag, {
            flagOn: t("featureFlags.detailsPage.flagOn"),
            flagOff: t("featureFlags.detailsPage.flagOff"),
          })
        : [],
    [flag, saved, t]
  )
  const variationChanges = useMemo(
    () =>
      saved && flag
        ? variationReviewChanges(saved.variations ?? [], flag.variations ?? [])
        : [],
    [flag, saved]
  )
  const decodedLicense = parseLicense(workspace?.license)
  const licenseStatus = getLicenseStatus(decodedLicense)
  const scheduleGranted = isFeatureGranted(
    { id: "schedule", labelKey: "", descriptionKey: "" },
    decodedLicense,
    licenseStatus
  )
  const changeRequestGranted = isFeatureGranted(
    { id: "change-request", labelKey: "", descriptionKey: "" },
    decodedLicense,
    licenseStatus
  )

  const saveMutation = useMutation({
    mutationFn: (comment: string) =>
      updateFeatureFlagTargeting(envId, flagKey, {
        targeting: targetingOf(flag!),
        revision: flag?.revision ?? "",
        comment,
      }),
    onSuccess: (revision) => {
      const updated = { ...cloneFlag(flag!), revision }
      queryClient.setQueryData(
        ["feature-flag-details", envId, flagKey],
        updated
      )
      setDraft(null)
      setReviewOpen(false)
      toast.success(t("featureFlags.operationSucceeded"))
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const toggleMutation = useMutation({
    mutationFn: ({
      nextEnabled,
      comment,
    }: {
      nextEnabled: boolean
      comment: string
    }) => toggleFeatureFlag(envId, flagKey, nextEnabled, comment),
    onSuccess: (revision, variables) => {
      const savedUpdated = {
        ...cloneFlag(saved!),
        isEnabled: variables.nextEnabled,
        revision,
      }
      const draftUpdated = {
        ...cloneFlag(flag!),
        isEnabled: variables.nextEnabled,
        revision,
      }
      queryClient.setQueryData(
        ["feature-flag-details", envId, flagKey],
        savedUpdated
      )
      setDraft(dirty ? { key: flagKey, value: draftUpdated } : null)
      setConfirmation(null)
      toast.success(t("featureFlags.operationSucceeded"))
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const variationsMutation = useMutation({
    mutationFn: (comment: string) =>
      updateFeatureFlagVariations(envId, flagKey, {
        variations: (flag?.variations ?? []).map((variation) => ({
          ...variation,
          name: variation.name.trim(),
        })),
        revision: flag?.revision ?? "",
        comment,
      }),
    onSuccess: (revision) => {
      const updated = {
        ...cloneFlag(flag!),
        variations: (flag?.variations ?? []).map((variation) => ({
          ...variation,
          name: variation.name.trim(),
        })),
        revision,
      }
      queryClient.setQueryData(
        ["feature-flag-details", envId, flagKey],
        updated
      )
      setDraft(null)
      setVariationsReviewOpen(false)
      toast.success(t("featureFlags.operationSucceeded"))
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const submissionMutation = useMutation({
    mutationFn: (input: TargetingSubmission) => {
      if (submission?.mode === "schedule") {
        return createFlagSchedule(envId, flagKey, {
          targeting: targetingOf(flag!),
          revision: flag?.revision ?? "",
          scheduledTime: new Date(input.scheduledTime).toISOString(),
          title: input.title,
          reviewers: input.reviewers,
          reason: input.reason,
          withChangeRequest: input.withChangeRequest,
        })
      }
      return createFlagChangeRequest(envId, flagKey, {
        targeting: targetingOf(flag!),
        revision: flag?.revision ?? "",
        reviewers: input.reviewers,
        reason: input.reason,
      })
    },
    onSuccess: () => {
      setSubmission(null)
      toast.success(t("featureFlags.operationSucceeded"))
      void pendingQuery.refetch()
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const removePendingMutation = useMutation({
    mutationFn: (item: PendingFlagChange) =>
      removePendingFlagChange(envId, item),
    onSuccess: (_, item) => {
      queryClient.setQueryData(
        ["flag-pending-changes", envId, flagKey],
        (current: PendingFlagChange[] | undefined) =>
          current?.filter((candidate) => candidate.id !== item.id) ?? []
      )
      toast.success(t("featureFlags.operationSucceeded"))
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const pendingActionMutation = useMutation({
    mutationFn: ({
      item,
      action,
    }: {
      item: PendingFlagChange
      action: "approve" | "decline" | "apply"
    }) =>
      updateFlagChangeRequest(envId, item.changeRequestId ?? item.id, action),
    onSuccess: (_, { item, action }) => {
      const currentUserId = getStoredUserProfile().id
      queryClient.setQueryData(
        ["flag-pending-changes", envId, flagKey],
        (current: PendingFlagChange[] | undefined) =>
          (current ?? []).map((candidate) => {
            if (candidate.id !== item.id) return candidate
            const status =
              action === "apply"
                ? "Applied"
                : action === "decline"
                  ? "Declined"
                  : candidate.type === "Schedule"
                    ? "PendingExecution"
                    : "Approved"
            return {
              ...candidate,
              status,
              reviewers:
                action === "apply"
                  ? candidate.reviewers
                  : candidate.reviewers?.map((reviewer) =>
                      reviewer.memberId === currentUserId
                        ? {
                            ...reviewer,
                            action:
                              action === "approve" ? "Approve" : "Decline",
                            timestamp: new Date().toISOString(),
                          }
                        : reviewer
                    ),
            }
          })
      )
      toast.success(t("featureFlags.operationSucceeded"))
      if (action === "apply") {
        void flagQuery.refetch()
      }
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })

  if (!envId || !flagKey || flagQuery.isError) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("featureFlags.detailsPage.loadFailed")}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(basePath)}>
              {t("featureFlags.detailsPage.back")}
            </Button>
            {envId && flagKey ? (
              <Button onClick={() => void flagQuery.refetch()}>
                {t("featureFlags.retry")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }
  if (
    !flag ||
    ((activeTab === "targeting" ||
      activeTab === "settings" ||
      activeTab === "variations") &&
      (policiesQuery.isLoading ||
        (activeTab === "targeting" &&
          (propertiesQuery.isLoading || usersQuery.isLoading))))
  ) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Skeleton className="mb-6 h-5 w-28" />
        <Skeleton className="mb-5 h-20 w-full" />
        <Skeleton className="mb-6 h-11 w-full" />
        <Skeleton className="h-[40rem] w-full" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
        <FlagDetailsHeader
          flag={flag}
          basePath={basePath}
          activeTab={activeTab}
        />
        {activeTab === "history" ? (
          <HistoryTab envId={envId} flagId={flag.id} lang={lang} />
        ) : activeTab === "insights" ? (
          <InsightsTab envId={envId} flag={flag} />
        ) : activeTab === "settings" ? (
          <SettingsTab
            envId={envId}
            flag={flag}
            requireComment={settingsQuery.data?.requireChangeComment ?? false}
            canUpdateName={can("UpdateFlagName")}
            canUpdateDescription={can("UpdateFlagDescription")}
            canUpdateTags={can("UpdateFlagTags")}
            canArchive={can("ArchiveFlag")}
            canRestore={can("RestoreFlag")}
            canDelete={can("DeleteFlag")}
            onSaved={(updated) => {
              queryClient.setQueryData(
                ["feature-flag-details", envId, flagKey],
                updated
              )
              setDraft(null)
            }}
            onRemoved={() => navigate(basePath)}
          />
        ) : activeTab === "variations" ? (
          <VariationsTab
            flag={flag}
            dirty={variationsDirty}
            saving={variationsMutation.isPending}
            canUpdate={can("UpdateFlagVariations")}
            onChange={(variations) =>
              setDraft({
                key: flagKey,
                value: { ...cloneFlag(flag), variations },
              })
            }
            onDiscard={() => setDraft(null)}
            onReview={() => setVariationsReviewOpen(true)}
          />
        ) : activeTab === "triggers" ? (
          <TriggersTab flagId={flag.id} archived={Boolean(flag.isArchived)} />
        ) : (
          <TargetingTab
            flag={flag}
            users={users}
            properties={propertiesQuery.data ?? []}
            pendingCount={pendingQuery.data?.length ?? 0}
            dirty={dirty}
            saving={saveMutation.isPending}
            toggling={toggleMutation.isPending}
            canToggle={can("ToggleFlag")}
            canUpdateOffVariation={can("UpdateFlagOffVariation")}
            canUpdateDefault={can("UpdateFlagDefaultRule")}
            canUpdateUsers={can("UpdateFlagIndividualTargeting")}
            canUpdateRules={can("UpdateFlagRules")}
            onDraftChange={(value) => setDraft({ key: flagKey, value })}
            onResolveUser={(user) =>
              setResolvedUsers((current) =>
                new Map(current).set(user.keyId, user)
              )
            }
            onDiscard={() => setDraft(null)}
            onReview={() => {
              setReviewInitialComment("")
              setReviewOpen(true)
            }}
            onOpenPending={() => setPendingOpen(true)}
            scheduleGranted={scheduleGranted}
            changeRequestGranted={changeRequestGranted}
            onSchedule={() =>
              setSubmission({ mode: "schedule", initialReason: "" })
            }
            onChangeRequest={() =>
              setSubmission({ mode: "change-request", initialReason: "" })
            }
            onToggle={(nextEnabled) =>
              setConfirmation({
                kind: "toggle",
                flag,
                nextEnabled,
                hasUnsavedTargeting: dirty,
                savedOffVariation: savedOffVariationLabel,
              })
            }
          />
        )}
        <FlagChangeReviewDialog
          open={reviewOpen}
          flagName={flag.name}
          changes={changes}
          requireComment={settingsQuery.data?.requireChangeComment ?? false}
          saving={saveMutation.isPending}
          initialComment={reviewInitialComment}
          scheduleGranted={scheduleGranted}
          changeRequestGranted={changeRequestGranted}
          onOpenChange={setReviewOpen}
          onSave={(comment) => saveMutation.mutate(comment)}
          onSchedule={(comment) => {
            setReviewOpen(false)
            setSubmission({ mode: "schedule", initialReason: comment })
          }}
          onChangeRequest={(comment) => {
            setReviewOpen(false)
            setSubmission({ mode: "change-request", initialReason: comment })
          }}
        />
        <VariationsReviewDialog
          open={variationsReviewOpen}
          flagName={flag.name}
          changes={variationChanges}
          requireComment={settingsQuery.data?.requireChangeComment ?? false}
          saving={variationsMutation.isPending}
          onOpenChange={setVariationsReviewOpen}
          onSave={(comment) => variationsMutation.mutate(comment)}
        />
        <PendingChangesSheet
          open={pendingOpen}
          flagName={flag.name}
          items={pendingQuery.data ?? []}
          loading={pendingQuery.isLoading}
          failed={pendingQuery.isError}
          removingId={
            removePendingMutation.isPending
              ? (removePendingMutation.variables?.id ?? null)
              : null
          }
          acting={
            pendingActionMutation.isPending
              ? {
                  id: pendingActionMutation.variables?.item.id ?? "",
                  action: pendingActionMutation.variables?.action ?? "approve",
                }
              : null
          }
          onOpenChange={setPendingOpen}
          onRetry={() => void pendingQuery.refetch()}
          onRemove={(item) => removePendingMutation.mutate(item)}
          onAction={(item, action) =>
            pendingActionMutation.mutate({ item, action })
          }
        />
        <TargetingSubmissionDialog
          key={submission ? "submission-open" : "submission-closed"}
          mode={submission?.mode ?? null}
          flagName={flag.name}
          changes={changes}
          initialReason={submission?.initialReason}
          scheduleGranted={scheduleGranted}
          changeRequestGranted={changeRequestGranted}
          saving={submissionMutation.isPending}
          onOpenChange={(open) => !open && setSubmission(null)}
          onModeChange={(mode, reason) => {
            if (mode === "save") {
              setSubmission(null)
              setReviewInitialComment(reason)
              setReviewOpen(true)
              return
            }
            setSubmission((current) =>
              current ? { ...current, mode, initialReason: reason } : current
            )
          }}
          onSubmit={(value) => submissionMutation.mutate(value)}
        />
        <FlagConfirmDialog
          key={
            confirmation ? `toggle-${flag.id}` : "toggle-confirmation-closed"
          }
          target={confirmation}
          saving={toggleMutation.isPending}
          requireComment={settingsQuery.data?.requireChangeComment ?? false}
          onOpenChange={(open) => !open && setConfirmation(null)}
          onConfirm={(comment) =>
            confirmation?.nextEnabled !== undefined &&
            toggleMutation.mutate({
              nextEnabled: confirmation.nextEnabled,
              comment,
            })
          }
        />
      </div>
    </TooltipProvider>
  )
}
