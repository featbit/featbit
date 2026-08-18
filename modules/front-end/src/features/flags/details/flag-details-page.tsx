import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { LicenseGateDialog } from "@/components/license-gate-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import { currentUserPoliciesQueryOptions } from "@/features/iam/current-user-policy-query"
import {
  createChangeRequest,
  deleteChangeRequest,
  fetchChangeRequestPreview,
  performChangeRequestAction,
} from "@/features/change-requests/change-requests-api"
import { ChangeRequestDecisionDialog } from "@/features/change-requests/components/change-request-decision-dialog"
import { ChangeRequestPreviewAlert } from "@/features/change-requests/components/change-request-preview-alert"
import {
  getCurrentOrganization,
  getCurrentProjectEnv,
  getCurrentWorkspace,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  fetchSegmentsByIds,
  fetchSegmentUserProperties,
  fetchSegmentUsersByKeyIds,
} from "@/features/segments/segments-api"
import type { SegmentEndUser } from "@/features/segments/segments-types"
import {
  getLicenseStatus,
  isFineGrainedAccessControlGranted,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import {
  createFlagSchedule,
  fetchFeatureFlag,
  fetchFlagEnvironmentSettings,
  fetchPendingFlagChanges,
  removePendingSchedule,
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
import type {
  FeatureFlag,
  FlagTargeting,
  FlagVariation,
  PendingFlagChange,
  UserPolicy,
} from "../flags-types"
import {
  FlagConfirmDialog,
  type FlagConfirmation,
} from "../index/components/flag-confirm-dialog"
import { FlagChangeReviewDialog } from "./flag-change-review-dialog"
import { FlagDetailsHeader } from "./flag-details-header"
import { withFlagTargeting, withFlagVariations } from "./flag-tab-state"
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
  targetingReviewSegmentIds,
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
  const [searchParams, setSearchParams] = useSearchParams()
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
  const previewChangeRequestId =
    activeTab === "targeting" && searchParams.get("mode") === "preview"
      ? (searchParams.get("changeRequestId")?.trim() ?? "")
      : ""
  const previewing = Boolean(previewChangeRequestId)
  const projectEnv = getCurrentProjectEnv()
  const workspace = getCurrentWorkspace()
  const organizationId = getCurrentOrganization()?.id ?? ""
  const fineGrainedGranted = isFineGrainedAccessControlGranted(
    workspace?.license
  )
  const envId = projectEnv?.envId ?? ""
  const basePath = localizedPath(lang, "/feature-flags")
  const manageLicenseHref = localizedPath(
    lang,
    getRuntimeEnv().hostingMode === "saas"
      ? "/workspace/billing"
      : "/workspace/license"
  )
  const [targetingDraft, setTargetingDraft] = useState<{
    key: string
    value: FlagTargeting
  } | null>(null)
  const [variationsDraft, setVariationsDraft] = useState<{
    key: string
    value: FlagVariation[]
  } | null>(null)
  const [resolvedUsers, setResolvedUsers] = useState<
    Map<string, SegmentEndUser>
  >(new Map())
  const [reviewOpen, setReviewOpen] = useState(false)
  const [variationsReviewOpen, setVariationsReviewOpen] = useState(false)
  const [reviewInitialComment, setReviewInitialComment] = useState("")
  const [pendingOpen, setPendingOpen] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<{
    item: PendingFlagChange
    action: "approve" | "decline"
  } | null>(null)
  const [confirmation, setConfirmation] = useState<FlagConfirmation>(null)
  const [submission, setSubmission] = useState<{
    mode: "schedule" | "change-request"
    initialReason: string
  } | null>(null)
  const [workflowLicenseGate, setWorkflowLicenseGate] = useState<
    "schedule" | "change-request" | null
  >(null)

  const flagQuery = useQuery({
    queryKey: ["feature-flag-details", envId, flagKey],
    queryFn: () => fetchFeatureFlag(envId, flagKey),
    enabled: Boolean(envId && flagKey),
  })
  const previewQuery = useQuery({
    queryKey: ["change-request-preview", envId, previewChangeRequestId],
    queryFn: () => fetchChangeRequestPreview(envId, previewChangeRequestId),
    enabled: Boolean(envId && previewChangeRequestId),
    retry: false,
  })
  const saved = flagQuery.data ?? null
  const changeRequestPreview =
    previewQuery.data?.flag.key === flagKey ? previewQuery.data : undefined
  const previewFailed = Boolean(
    previewing &&
    (previewQuery.isError || (previewQuery.isSuccess && !changeRequestPreview))
  )
  const targetingFlag = previewing
    ? (changeRequestPreview?.flag ?? null)
    : saved && targetingDraft?.key === flagKey
      ? withFlagTargeting(saved, targetingDraft.value)
      : saved
  const variationsFlag =
    saved && variationsDraft?.key === flagKey
      ? withFlagVariations(saved, variationsDraft.value)
      : saved
  const selectedKeys = useMemo(
    () => (targetingFlag?.targetUsers ?? []).flatMap((item) => item.keyIds),
    [targetingFlag?.targetUsers]
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
    enabled: Boolean(
      activeTab === "targeting" && !previewing && envId && flagKey
    ),
  })
  const policiesQuery = useQuery({
    ...currentUserPoliciesQueryOptions<UserPolicy>(organizationId),
    enabled:
      Boolean(organizationId) &&
      ((activeTab === "targeting" && !previewing) ||
        activeTab === "settings" ||
        activeTab === "variations"),
    staleTime: 5 * 60_000,
  })
  const settingsQuery = useQuery({
    queryKey: ["feature-flag-environment-settings", envId],
    queryFn: () => fetchFlagEnvironmentSettings(envId),
    enabled: Boolean(
      (activeTab === "targeting" ||
        activeTab === "settings" ||
        activeTab === "variations") &&
      !previewing &&
      envId
    ),
    staleTime: 5 * 60_000,
  })

  function exitChangeRequestPreview() {
    const next = new URLSearchParams(searchParams)
    next.delete("changeRequestId")
    next.delete("mode")
    setSearchParams(next, { replace: true })
  }

  const users = useMemo(() => {
    const map = new Map(resolvedUsers)
    for (const user of usersQuery.data ?? []) map.set(user.keyId, user)
    return map
  }, [resolvedUsers, usersQuery.data])
  const resourceRn = saved
    ? featureFlagRn(
        environmentRn({
          projectKey: projectEnv?.projectKey ?? "",
          environmentKey: projectEnv?.envKey ?? "",
        }),
        saved
      )
    : ""
  function can(action: FlagAction) {
    return Boolean(
      saved &&
      policiesQuery.isSuccess &&
      canUseFlagAction(
        policiesQuery.data,
        resourceRn,
        action,
        fineGrainedGranted
      )
    )
  }
  const canManageTargetingWorkflow =
    can("UpdateFlagOffVariation") ||
    can("UpdateFlagDefaultRule") ||
    can("UpdateFlagIndividualTargeting") ||
    can("UpdateFlagTargetingRules")

  function showPermissionDenied() {
    toast.error(t("featureFlags.permissionDenied"))
  }
  const dirty =
    !previewing &&
    Boolean(
      saved &&
      targetingFlag &&
      stableFlagTargeting(saved) !== stableFlagTargeting(targetingFlag)
    )
  const variationsDirty = Boolean(
    saved &&
    variationsFlag &&
    stableVariations(saved.variations) !==
      stableVariations(variationsFlag.variations)
  )
  const savedOffVariation = saved?.variations?.find(
    (variation) => variation.id === saved.disabledVariationId
  )
  const savedOffVariationLabel =
    savedOffVariation?.name || savedOffVariation?.value || undefined
  const changes = useMemo(
    () =>
      saved && targetingFlag
        ? targetingReviewChanges(saved, targetingFlag, {
            flagOn: t("featureFlags.detailsPage.flagOn"),
            flagOff: t("featureFlags.detailsPage.flagOff"),
          })
        : [],
    [saved, t, targetingFlag]
  )
  const reviewSegmentIds = useMemo(
    () => targetingReviewSegmentIds(changes),
    [changes]
  )
  const reviewSegmentsQuery = useQuery({
    queryKey: ["targeting-segments-by-id", envId, reviewSegmentIds],
    queryFn: () => fetchSegmentsByIds(envId, reviewSegmentIds),
    enabled: Boolean(envId && reviewSegmentIds.length),
    staleTime: 60_000,
  })
  const reviewSegmentNames = useMemo(
    () =>
      new Map(
        (reviewSegmentsQuery.data ?? []).map((segment) => [
          segment.id,
          segment.name,
        ])
      ),
    [reviewSegmentsQuery.data]
  )
  const variationChanges = useMemo(
    () =>
      saved && variationsFlag
        ? variationReviewChanges(
            saved.variations ?? [],
            variationsFlag.variations ?? []
          )
        : [],
    [saved, variationsFlag]
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

  function openSubmission(
    mode: "schedule" | "change-request",
    initialReason: string
  ) {
    const granted = mode === "schedule" ? scheduleGranted : changeRequestGranted
    if (!granted) {
      setReviewOpen(false)
      setWorkflowLicenseGate(mode)
      return
    }
    setReviewOpen(false)
    setSubmission({ mode, initialReason })
  }

  const saveMutation = useMutation({
    mutationFn: (comment: string) =>
      updateFeatureFlagTargeting(envId, flagKey, {
        targeting: targetingOf(targetingFlag!),
        revision: saved?.revision ?? "",
        comment,
      }),
    onSuccess: (revision) => {
      queryClient.setQueryData(
        ["feature-flag-details", envId, flagKey],
        (current: FeatureFlag | undefined) =>
          current
            ? withFlagTargeting(current, targetingOf(targetingFlag!), revision)
            : current
      )
      setTargetingDraft(null)
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
      queryClient.setQueryData(
        ["feature-flag-details", envId, flagKey],
        (current: FeatureFlag | undefined) =>
          current
            ? {
                ...cloneFlag(current),
                isEnabled: variables.nextEnabled,
                revision,
              }
            : current
      )
      setConfirmation(null)
      toast.success(t("featureFlags.operationSucceeded"))
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const variationsMutation = useMutation({
    mutationFn: (comment: string) =>
      updateFeatureFlagVariations(envId, flagKey, {
        variations: (variationsFlag?.variations ?? []).map((variation) => ({
          ...variation,
          name: variation.name.trim(),
        })),
        revision: saved?.revision ?? "",
        comment,
      }),
    onSuccess: (revision) => {
      const variations = (variationsFlag?.variations ?? []).map(
        (variation) => ({
          ...variation,
          name: variation.name.trim(),
        })
      )
      queryClient.setQueryData(
        ["feature-flag-details", envId, flagKey],
        (current: FeatureFlag | undefined) =>
          current ? withFlagVariations(current, variations, revision) : current
      )
      setVariationsDraft(null)
      setVariationsReviewOpen(false)
      toast.success(t("featureFlags.operationSucceeded"))
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const submissionMutation = useMutation({
    mutationFn: async (input: TargetingSubmission) => {
      if (submission?.mode === "schedule") {
        await createFlagSchedule(envId, flagKey, {
          targeting: targetingOf(targetingFlag!),
          revision: saved?.revision ?? "",
          scheduledTime: new Date(input.scheduledTime).toISOString(),
          title: input.title,
          reviewers: input.reviewers,
          reason: input.reason,
          withChangeRequest: input.withChangeRequest,
        })
        return
      }
      await createChangeRequest(envId, flagKey, {
        targeting: targetingOf(targetingFlag!),
        revision: saved?.revision ?? "",
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
      item.type === "Schedule"
        ? removePendingSchedule(envId, item.id)
        : deleteChangeRequest(envId, item.changeRequestId ?? item.id),
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
      comment,
    }: {
      item: PendingFlagChange
      action: "approve" | "decline" | "apply"
      comment?: string
    }) =>
      performChangeRequestAction(
        envId,
        item.changeRequestId ?? item.id,
        action,
        comment
      ),
    onSuccess: (_, { item, action }) => {
      setPendingDecision(null)
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
    !saved ||
    (activeTab === "targeting" &&
      (propertiesQuery.isLoading ||
        usersQuery.isLoading ||
        (previewing ? previewQuery.isLoading : policiesQuery.isLoading))) ||
    ((activeTab === "settings" || activeTab === "variations") &&
      policiesQuery.isLoading)
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
          flag={saved}
          basePath={basePath}
          activeTab={activeTab}
        />
        {activeTab === "history" ? (
          <HistoryTab envId={envId} flagId={saved.id} lang={lang} />
        ) : activeTab === "insights" ? (
          <InsightsTab envId={envId} flag={saved} />
        ) : activeTab === "settings" ? (
          <SettingsTab
            envId={envId}
            flag={saved}
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
            }}
            onRemoved={() => navigate(basePath)}
          />
        ) : activeTab === "variations" ? (
          <VariationsTab
            flag={variationsFlag!}
            dirty={variationsDirty}
            saving={variationsMutation.isPending}
            canUpdate={can("UpdateFlagVariations")}
            onChange={(variations) =>
              setVariationsDraft({
                key: flagKey,
                value: structuredClone(variations),
              })
            }
            onDiscard={() => setVariationsDraft(null)}
            onReview={() => setVariationsReviewOpen(true)}
          />
        ) : activeTab === "triggers" ? (
          <TriggersTab flagId={saved.id} archived={Boolean(saved.isArchived)} />
        ) : previewing && previewFailed ? (
          <ChangeRequestPreviewAlert
            failed
            onRetry={() => void previewQuery.refetch()}
            onExit={exitChangeRequestPreview}
          />
        ) : (
          <>
            {previewing ? (
              <ChangeRequestPreviewAlert
                preview={changeRequestPreview}
                failed={false}
                onRetry={() => void previewQuery.refetch()}
                onExit={exitChangeRequestPreview}
              />
            ) : null}
            <TargetingTab
              envId={envId}
              flag={targetingFlag!}
              users={users}
              properties={propertiesQuery.data ?? []}
              pendingCount={previewing ? 0 : (pendingQuery.data?.length ?? 0)}
              dirty={dirty}
              saving={saveMutation.isPending}
              toggling={toggleMutation.isPending}
              readOnly={previewing}
              canToggle={!previewing && can("ToggleFlag")}
              canUpdateOffVariation={
                !previewing && can("UpdateFlagOffVariation")
              }
              canUpdateDefault={!previewing && can("UpdateFlagDefaultRule")}
              canUpdateUsers={
                !previewing && can("UpdateFlagIndividualTargeting")
              }
              canUpdateRules={!previewing && can("UpdateFlagTargetingRules")}
              onDraftChange={(value) => {
                if (!previewing) {
                  setTargetingDraft({
                    key: flagKey,
                    value: targetingOf(value),
                  })
                }
              }}
              onResolveUser={(user) =>
                setResolvedUsers((current) =>
                  new Map(current).set(user.keyId, user)
                )
              }
              onDiscard={() => setTargetingDraft(null)}
              onReview={() => {
                if (previewing) return
                if (!canManageTargetingWorkflow) {
                  showPermissionDenied()
                  return
                }
                setReviewInitialComment("")
                setReviewOpen(true)
              }}
              onOpenPending={() => !previewing && setPendingOpen(true)}
              onPermissionDenied={showPermissionDenied}
              onSchedule={() => {
                if (!previewing) {
                  openSubmission("schedule", "")
                }
              }}
              onChangeRequest={() => {
                if (!previewing) {
                  openSubmission("change-request", "")
                }
              }}
              onToggle={(nextEnabled) => {
                if (previewing) return
                setConfirmation({
                  kind: "toggle",
                  flag: targetingFlag!,
                  nextEnabled,
                  hasUnsavedTargeting: dirty,
                  savedOffVariation: savedOffVariationLabel,
                })
              }}
            />
          </>
        )}
        <FlagChangeReviewDialog
          open={reviewOpen}
          flagName={saved.name}
          changes={changes}
          segmentNames={reviewSegmentNames}
          requireComment={settingsQuery.data?.requireChangeComment ?? false}
          saving={saveMutation.isPending}
          initialComment={reviewInitialComment}
          onOpenChange={setReviewOpen}
          onSave={(comment) => saveMutation.mutate(comment)}
          onSchedule={(comment) => {
            openSubmission("schedule", comment)
          }}
          onChangeRequest={(comment) => {
            openSubmission("change-request", comment)
          }}
        />
        <VariationsReviewDialog
          open={variationsReviewOpen}
          flagName={saved.name}
          changes={variationChanges}
          requireComment={settingsQuery.data?.requireChangeComment ?? false}
          saving={variationsMutation.isPending}
          onOpenChange={setVariationsReviewOpen}
          onSave={(comment) => variationsMutation.mutate(comment)}
        />
        <PendingChangesSheet
          open={pendingOpen}
          flagName={saved.name}
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
          onAction={(item, action) => {
            if (action === "apply") {
              pendingActionMutation.mutate({ item, action })
              return
            }
            setPendingDecision({ item, action })
          }}
        />
        {pendingDecision ? (
          <ChangeRequestDecisionDialog
            key={`${pendingDecision.item.id}-${pendingDecision.action}`}
            action={pendingDecision.action}
            requestTitle={
              pendingDecision.item.changeRequestReason?.trim() ||
              pendingDecision.item.scheduleTitle?.trim() ||
              t("changeRequests.fallbackRequest")
            }
            saving={pendingActionMutation.isPending}
            onOpenChange={(open) => {
              if (!open) setPendingDecision(null)
            }}
            onConfirm={(comment) =>
              pendingActionMutation.mutate({ ...pendingDecision, comment })
            }
          />
        ) : null}
        <TargetingSubmissionDialog
          key={submission ? "submission-open" : "submission-closed"}
          mode={submission?.mode ?? null}
          flagName={saved.name}
          changes={changes}
          segmentNames={reviewSegmentNames}
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
        <LicenseGateDialog
          open={workflowLicenseGate !== null}
          title={t(
            workflowLicenseGate === "schedule"
              ? "featureFlags.detailsPage.licenseGate.scheduleTitle"
              : "featureFlags.detailsPage.licenseGate.changeRequestTitle"
          )}
          description={t(
            workflowLicenseGate === "schedule"
              ? "featureFlags.detailsPage.licenseGate.scheduleDescription"
              : "featureFlags.detailsPage.licenseGate.changeRequestDescription"
          )}
          actionLabel={t("featureFlags.detailsPage.licenseGate.manageLicense")}
          actionHref={manageLicenseHref}
          note={t(
            workflowLicenseGate === "schedule"
              ? "featureFlags.detailsPage.licenseGate.scheduleNote"
              : "featureFlags.detailsPage.licenseGate.changeRequestNote"
          )}
          closeLabel={t("featureFlags.detailsPage.licenseGate.close")}
          onOpenChange={(open) => !open && setWorkflowLicenseGate(null)}
        />
        <FlagConfirmDialog
          key={
            confirmation ? `toggle-${saved.id}` : "toggle-confirmation-closed"
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
