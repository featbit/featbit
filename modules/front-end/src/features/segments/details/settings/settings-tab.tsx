import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import {
  archiveSegment,
  removeSegment,
  restoreSegment,
  updateSegmentGeneral,
} from "../../segments-api"
import type { Segment } from "../../segments-types"
import {
  SegmentConfirmDialog,
  type SegmentConfirmation,
} from "../../index/components/segment-dialogs"
import { ChangeReviewDialog } from "../components/change-review-dialog"
import {
  settingsReviewChanges,
  stableSettings,
  type ReviewChange,
} from "../segment-details-utils"
import { SegmentTagPicker } from "./segment-tag-picker"

type Props = {
  envId: string
  segment: Segment
  requireComment: boolean
  canUpdateName: boolean
  canUpdateDescription: boolean
  canUpdateTags: boolean
  canArchive: boolean
  canRestore: boolean
  canDelete: boolean
  onSaved: (segment: Segment) => void
  onRemoved: () => void
}

type FormValues = {
  name: string
  description: string
  tags: string[]
}

export function SettingsTab({
  envId,
  segment,
  requireComment,
  canUpdateName,
  canUpdateDescription,
  canUpdateTags,
  canArchive,
  canRestore,
  canDelete,
  onSaved,
  onRemoved,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<SegmentConfirmation>(null)
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("segments.create.nameRequired")),
        description: z.string(),
        tags: z.array(z.string()),
      }),
    [t]
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: segment.name,
      description: segment.description,
      tags: segment.tags,
    },
  })

  useEffect(() => {
    form.reset({
      name: segment.name,
      description: segment.description,
      tags: segment.tags,
    })
  }, [form, segment])

  const values = useWatch({ control: form.control })
  const draft = useMemo(
    () => ({
      ...segment,
      name: values.name ?? segment.name,
      description: values.description ?? segment.description,
      tags: values.tags ?? segment.tags,
    }),
    [segment, values.description, values.name, values.tags]
  )
  const submittedDraft = useMemo(
    () => ({
      ...draft,
      name:
        !canUpdateName || draft.name === segment.name
          ? segment.name
          : draft.name.trim(),
      description: canUpdateDescription
        ? draft.description
        : segment.description,
      tags: canUpdateTags ? draft.tags : segment.tags,
    }),
    [
      canUpdateDescription,
      canUpdateName,
      canUpdateTags,
      draft,
      segment.description,
      segment.name,
      segment.tags,
    ]
  )
  const dirty = stableSettings(submittedDraft) !== stableSettings(segment)
  const changes = useMemo<ReviewChange[]>(
    () => settingsReviewChanges(segment, submittedDraft),
    [segment, submittedDraft]
  )
  const archived = Boolean(segment.isArchived)

  const saveMutation = useMutation({
    mutationFn: async (comment: string) => {
      const input = {
        name: submittedDraft.name,
        description: submittedDraft.description,
        tags: submittedDraft.tags,
      }
      const success = await updateSegmentGeneral(
        envId,
        segment.id,
        input,
        comment
      )
      if (!success) throw new Error("Segment General update failed")
      return { ...segment, ...input }
    },
    onSuccess: (saved) => {
      onSaved(saved)
      setReviewOpen(false)
      toast.success(t("segments.operationSucceeded"))
      void queryClient.invalidateQueries({
        queryKey: ["segment-tags", envId],
      })
      void queryClient.invalidateQueries({ queryKey: ["segment-audit-logs"] })
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError && error.status === 403
          ? t("segments.permissionDenied")
          : t("segments.operationFailed")
      ),
  })

  const lifecycleMutation = useMutation({
    mutationFn: ({
      target,
      comment,
    }: {
      target: NonNullable<SegmentConfirmation>
      comment: string
    }) => {
      if (target.kind === "archive")
        return archiveSegment(envId, segment.id, comment)
      if (target.kind === "restore")
        return restoreSegment(envId, segment.id, comment)
      return removeSegment(envId, segment.id, comment)
    },
    onSuccess: (success, { target }) => {
      if (!success) {
        toast.error(t("segments.operationFailed"))
        return
      }
      setConfirmation(null)
      toast.success(t("segments.operationSucceeded"))
      void queryClient.invalidateQueries({ queryKey: ["segments"] })
      void queryClient.invalidateQueries({
        queryKey: ["segment-audit-logs"],
      })
      if (target.kind === "remove") {
        onRemoved()
        return
      }
      onSaved({ ...segment, isArchived: target.kind === "archive" })
    },
    onError: () => toast.error(t("segments.operationFailed")),
  })

  const tags = values.tags ?? []
  return (
    <form
      className="space-y-8 pt-4 pb-8"
      onSubmit={form.handleSubmit(() => setReviewOpen(true))}
    >
      <section className="max-w-3xl space-y-5">
        <h2 className="text-base font-medium">
          {t("segments.detailsPage.settings.general")}
        </h2>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="segment-name">{t("segments.create.name")}</Label>
            <Input
              id="segment-name"
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
                {t("segments.detailsPage.settings.nameHelp")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment-description">
              {t("segments.create.descriptionLabel")}
              <span className="font-normal text-muted-foreground">
                {` ${t("segments.detailsPage.optional")}`}
              </span>
            </Label>
            <Textarea
              id="segment-description"
              rows={4}
              disabled={archived || !canUpdateDescription}
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("segments.detailsPage.tags")}</Label>
            <SegmentTagPicker
              key={`${envId}-${segment.id}`}
              envId={envId}
              tags={tags}
              disabled={archived || !canUpdateTags}
              onChange={(nextTags) =>
                form.setValue("tags", nextTags, { shouldDirty: true })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("segments.detailsPage.settings.tagInputHelp")}
            </p>
          </div>
        </div>

        {!archived ? (
          <div className="flex items-center justify-end gap-3 pt-1">
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() =>
                  form.reset({
                    name: segment.name,
                    description: segment.description,
                    tags: segment.tags,
                  })
                }
              >
                {t("segments.detailsPage.discard")}
              </Button>
            ) : null}
            <Button type="submit" disabled={!dirty || saveMutation.isPending}>
              {t("segments.detailsPage.reviewAndSave")}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="max-w-3xl border-t pt-6">
        <h2 className="mb-3 text-base font-medium">
          {t("segments.detailsPage.settings.lifecycle")}
        </h2>
        {archived ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-6 py-1">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("segments.detailsPage.settings.restoreTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("segments.detailsPage.settings.restoreHelp")}
                </p>
                {!canRestore ? (
                  <p className="text-xs text-muted-foreground">
                    {t("segments.permissionDenied")}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!canRestore}
                onClick={() => setConfirmation({ kind: "restore", segment })}
              >
                {t("segments.restore")}
              </Button>
            </div>

            <div className="flex items-start justify-between gap-6 py-1">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("segments.detailsPage.settings.removeTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("segments.detailsPage.settings.removeHelp")}
                </p>
                {!canDelete ? (
                  <p className="text-xs text-muted-foreground">
                    {t("segments.permissionDenied")}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="destructive"
                className="shrink-0"
                disabled={!canDelete}
                onClick={() => setConfirmation({ kind: "remove", segment })}
              >
                {t("segments.detailsPage.settings.removePermanently")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-6 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("segments.detailsPage.settings.archiveTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("segments.detailsPage.settings.archiveHelp")}
              </p>
              {!canArchive ? (
                <p className="text-xs text-muted-foreground">
                  {t("segments.permissionDenied")}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={!canArchive}
              onClick={() => setConfirmation({ kind: "archive", segment })}
            >
              {t("segments.archive")}
            </Button>
          </div>
        )}
      </section>

      <ChangeReviewDialog
        open={reviewOpen}
        kind="settings"
        segmentName={segment.name}
        changes={changes}
        requireComment={requireComment}
        saving={saveMutation.isPending}
        onOpenChange={setReviewOpen}
        onSave={(comment) => saveMutation.mutate(comment)}
      />
      <SegmentConfirmDialog
        key={confirmation ? `${confirmation.kind}-${segment.id}` : "closed"}
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
