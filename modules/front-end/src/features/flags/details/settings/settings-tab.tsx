import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import {
  archiveFeatureFlag,
  fetchRunningExperiments,
  removeFeatureFlag,
  restoreFeatureFlag,
  updateFeatureFlagGeneral,
} from "../../flags-api"
import type { FeatureFlag } from "../../flags-types"
import {
  FlagConfirmDialog,
  type FlagConfirmation,
} from "../../index/components/flag-confirm-dialog"
import { FlagTagPicker } from "../../index/components/flag-tag-picker"
import { SettingsReviewDialog } from "./settings-review-dialog"
import {
  flagSettingsOf,
  flagSettingsReviewChanges,
  stableFlagSettings,
  type FlagSettingsValues,
} from "./settings-utils"

type Props = {
  envId: string
  flag: FeatureFlag
  requireComment: boolean
  canUpdateName: boolean
  canUpdateDescription: boolean
  canUpdateTags: boolean
  canToggle: boolean
  canArchive: boolean
  canRestore: boolean
  canDelete: boolean
  onSaved: (flag: FeatureFlag) => void
  onRemoved: () => void
}

export function SettingsTab({
  envId,
  flag,
  requireComment,
  canUpdateName,
  canUpdateDescription,
  canUpdateTags,
  canToggle,
  canArchive,
  canRestore,
  canDelete,
  onSaved,
  onRemoved,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<FlagConfirmation>(null)
  const baseline = useMemo(() => flagSettingsOf(flag), [flag])
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("featureFlags.detailsPage.settings.nameRequired")),
        description: z.string(),
        tags: z.array(z.string()),
        insightsEnabled: z.boolean(),
      }),
    [t]
  )
  const form = useForm<FlagSettingsValues>({
    resolver: zodResolver(schema),
    defaultValues: baseline,
  })

  useEffect(() => {
    form.reset(baseline)
  }, [baseline, form])

  const watched = useWatch({ control: form.control })
  const draft = useMemo<FlagSettingsValues>(
    () => ({
      name: watched.name ?? baseline.name,
      description: watched.description ?? baseline.description,
      tags: watched.tags ?? baseline.tags,
      insightsEnabled: watched.insightsEnabled ?? baseline.insightsEnabled,
    }),
    [
      baseline,
      watched.description,
      watched.insightsEnabled,
      watched.name,
      watched.tags,
    ]
  )
  const submittedDraft = useMemo<FlagSettingsValues>(
    () => ({
      name:
        !canUpdateName || draft.name === baseline.name
          ? baseline.name
          : draft.name.trim(),
      description: canUpdateDescription
        ? draft.description
        : baseline.description,
      tags: canUpdateTags ? draft.tags : baseline.tags,
      insightsEnabled: canToggle
        ? draft.insightsEnabled
        : baseline.insightsEnabled,
    }),
    [
      baseline.description,
      baseline.insightsEnabled,
      baseline.name,
      baseline.tags,
      canToggle,
      canUpdateDescription,
      canUpdateName,
      canUpdateTags,
      draft.description,
      draft.insightsEnabled,
      draft.name,
      draft.tags,
    ]
  )
  const dirty =
    stableFlagSettings(submittedDraft) !== stableFlagSettings(baseline)
  const changes = useMemo(
    () =>
      flagSettingsReviewChanges(baseline, submittedDraft, (enabled) =>
        t(
          `featureFlags.detailsPage.settings.insightsValue.${enabled ? "enabled" : "disabled"}`
        )
      ),
    [baseline, submittedDraft, t]
  )
  const archived = Boolean(flag.isArchived)
  const runningExperimentsKey = ["flag-running-experiments", envId, flag.key]
  // experiments need insight data: only relevant while insights are still on
  const runningExperimentsQuery = useQuery({
    queryKey: runningExperimentsKey,
    queryFn: () => fetchRunningExperiments(envId, flag.key),
    enabled: baseline.insightsEnabled && !archived,
  })
  const runningExperiments = baseline.insightsEnabled
    ? (runningExperimentsQuery.data ?? [])
    : []
  const insightsLocked = runningExperiments.length > 0 && draft.insightsEnabled

  const saveMutation = useMutation({
    mutationFn: async (comment: string) => {
      const revision = await updateFeatureFlagGeneral(
        envId,
        flag.key,
        submittedDraft,
        comment
      )
      return { ...flag, ...submittedDraft, revision }
    },
    onSuccess: (saved) => {
      onSaved(saved)
      setReviewOpen(false)
      toast.success(t("featureFlags.operationSucceeded"))
      void queryClient.invalidateQueries({
        queryKey: ["feature-flag-tags", envId],
      })
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
      void queryClient.invalidateQueries({ queryKey: ["flag-audit-logs"] })
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 409) {
        // an experiment started since the page loaded: refresh the list shown next to the checkbox
        void queryClient.invalidateQueries({ queryKey: runningExperimentsKey })
        toast.error(
          t("featureFlags.detailsPage.settings.insightsBlockedByExperiments", {
            names: runningExperiments.map((x) => x.name).join(", "),
          })
        )
        return
      }
      toast.error(
        error instanceof ApiRequestError && error.status === 403
          ? t("featureFlags.permissionDenied")
          : t("featureFlags.operationFailed")
      )
    },
  })

  const lifecycleMutation = useMutation({
    mutationFn: ({
      target,
      comment,
    }: {
      target: NonNullable<FlagConfirmation>
      comment: string
    }) => {
      if (target.kind === "archive")
        return archiveFeatureFlag(envId, flag.key, comment)
      if (target.kind === "restore")
        return restoreFeatureFlag(envId, flag.key, comment)
      return removeFeatureFlag(envId, flag.key, comment)
    },
    onSuccess: (success, { target }) => {
      if (!success) {
        toast.error(t("featureFlags.operationFailed"))
        return
      }
      setConfirmation(null)
      toast.success(t("featureFlags.operationSucceeded"))
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
      if (target.kind === "remove") {
        onRemoved()
        return
      }
      onSaved({ ...flag, isArchived: target.kind === "archive" })
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })

  return (
    <form
      className="space-y-8 pt-4 pb-8"
      onSubmit={form.handleSubmit(() => setReviewOpen(true))}
    >
      <section className="max-w-3xl space-y-5">
        <h2 className="text-base font-medium">
          {t("featureFlags.detailsPage.settings.general")}
        </h2>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="flag-name">
              {t("featureFlags.detailsPage.settings.fields.name")}
            </Label>
            <Input
              id="flag-name"
              disabled={archived || !canUpdateName}
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("featureFlags.detailsPage.settings.nameHelp")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="flag-description">
              {t("featureFlags.detailsPage.settings.fields.description")}
              <span className="font-normal text-muted-foreground">
                {` ${t("featureFlags.detailsPage.review.optional")}`}
              </span>
            </Label>
            <Textarea
              id="flag-description"
              rows={4}
              disabled={archived || !canUpdateDescription}
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("featureFlags.detailsPage.settings.fields.tags")}</Label>
            <FlagTagPicker
              key={`${envId}-${flag.id}`}
              envId={envId}
              tags={draft.tags}
              disabled={archived || !canUpdateTags}
              onChange={(tags) =>
                form.setValue("tags", tags, { shouldDirty: true })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("featureFlags.detailsPage.settings.tagsHelp")}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="flag-insights-enabled"
              className="mt-0.5"
              checked={draft.insightsEnabled}
              disabled={archived || !canToggle || insightsLocked}
              onCheckedChange={(checked) =>
                form.setValue("insightsEnabled", checked === true, {
                  shouldDirty: true,
                })
              }
            />
            <div className="space-y-1">
              <Label htmlFor="flag-insights-enabled">
                {t("featureFlags.detailsPage.settings.fields.insightsEnabled")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("featureFlags.detailsPage.settings.insightsHelp")}
              </p>
              {runningExperiments.length > 0 ? (
                <p className="text-xs text-destructive">
                  {t(
                    "featureFlags.detailsPage.settings.insightsBlockedByExperiments",
                    {
                      names: runningExperiments.map((x) => x.name).join(", "),
                    }
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {!archived ? (
          <div className="flex items-center justify-end gap-3 pt-1">
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() => form.reset(baseline)}
              >
                {t("featureFlags.detailsPage.discard")}
              </Button>
            ) : null}
            <Button type="submit" disabled={saveMutation.isPending}>
              {t("featureFlags.detailsPage.reviewAndSave")}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="max-w-3xl border-t pt-6">
        <h2 className="mb-3 text-base font-medium">
          {t("featureFlags.detailsPage.settings.lifecycle")}
        </h2>
        {archived ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-6 py-1">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("featureFlags.detailsPage.settings.restoreTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("featureFlags.detailsPage.settings.restoreHelp")}
                </p>
                {!canRestore ? (
                  <p className="text-xs text-muted-foreground">
                    {t("featureFlags.permissionDenied")}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!canRestore}
                onClick={() => setConfirmation({ kind: "restore", flag })}
              >
                {t("featureFlags.restore")}
              </Button>
            </div>
            <div className="flex items-start justify-between gap-6 py-1">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("featureFlags.detailsPage.settings.removeTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("featureFlags.detailsPage.settings.removeHelp")}
                </p>
                {!canDelete ? (
                  <p className="text-xs text-muted-foreground">
                    {t("featureFlags.permissionDenied")}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="destructive"
                className="shrink-0"
                disabled={!canDelete}
                onClick={() => setConfirmation({ kind: "remove", flag })}
              >
                {t("featureFlags.detailsPage.settings.removePermanently")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-6 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("featureFlags.detailsPage.settings.archiveTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("featureFlags.detailsPage.settings.archiveHelp")}
              </p>
              {!canArchive ? (
                <p className="text-xs text-muted-foreground">
                  {t("featureFlags.permissionDenied")}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={!canArchive}
              onClick={() => setConfirmation({ kind: "archive", flag })}
            >
              {t("featureFlags.archive")}
            </Button>
          </div>
        )}
      </section>

      <SettingsReviewDialog
        open={reviewOpen}
        flagName={flag.name}
        changes={changes}
        requireComment={requireComment}
        saving={saveMutation.isPending}
        onOpenChange={setReviewOpen}
        onSave={(comment) => saveMutation.mutate(comment)}
      />
      <FlagConfirmDialog
        key={confirmation ? `${confirmation.kind}-${flag.id}` : "closed"}
        target={confirmation}
        saving={lifecycleMutation.isPending}
        requireComment={requireComment}
        onOpenChange={(open) => !open && setConfirmation(null)}
        onConfirm={(comment) => {
          if (confirmation)
            lifecycleMutation.mutate({ target: confirmation, comment })
        }}
      />
    </form>
  )
}
