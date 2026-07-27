import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
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
  toggleFeatureFlag,
  updateFeatureFlagTargeting,
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

export function FlagDetailsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const lang = resolveLang(params.lang)
  const flagKey = decodeURIComponent(params.flagKey ?? "")
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
    enabled: Boolean(envId && selectedKeys.length),
  })
  const propertiesQuery = useQuery({
    queryKey: ["flag-user-properties", envId],
    queryFn: () => fetchSegmentUserProperties(envId),
    enabled: Boolean(envId),
    staleTime: 60_000,
  })
  const pendingQuery = useQuery({
    queryKey: ["flag-pending-changes", envId, flagKey],
    queryFn: () => fetchPendingFlagChanges(envId, flagKey),
    enabled: Boolean(envId && flagKey),
  })
  const policiesQuery = useQuery({
    queryKey: ["feature-flag-policies", workspace?.id ?? ""],
    queryFn: fetchFlagPolicies,
    staleTime: 5 * 60_000,
  })
  const settingsQuery = useQuery({
    queryKey: ["feature-flag-environment-settings", envId],
    queryFn: () => fetchFlagEnvironmentSettings(envId),
    enabled: Boolean(envId),
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
    policiesQuery.isLoading ||
    propertiesQuery.isLoading ||
    usersQuery.isLoading
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
          toggling={toggleMutation.isPending}
          canToggle={can("ToggleFlag")}
          onToggle={() =>
            setConfirmation({
              kind: "toggle",
              flag,
              nextEnabled: !flag.isEnabled,
            })
          }
        />
        <TargetingTab
          flag={flag}
          users={users}
          properties={propertiesQuery.data ?? []}
          pendingCount={pendingQuery.data?.length ?? 0}
          dirty={dirty}
          saving={saveMutation.isPending}
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
        />
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
        <PendingChangesSheet
          open={pendingOpen}
          items={pendingQuery.data ?? []}
          removingId={
            removePendingMutation.isPending
              ? (removePendingMutation.variables?.id ?? null)
              : null
          }
          onOpenChange={setPendingOpen}
          onRemove={(item) => removePendingMutation.mutate(item)}
        />
        <TargetingSubmissionDialog
          key={submission ? "submission" : "closed"}
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
          key={confirmation ? `toggle-${flag.id}` : "closed"}
          lang={lang}
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
