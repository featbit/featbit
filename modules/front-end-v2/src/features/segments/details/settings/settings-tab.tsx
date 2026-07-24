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
import {
  updateSegmentDescription,
  updateSegmentName,
  updateSegmentTags,
} from "../../segments-api"
import type { Segment } from "../../segments-types"
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
  onSaved: (segment: Segment) => void
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
  onSaved,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reviewOpen, setReviewOpen] = useState(false)
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
  const dirty = stableSettings(draft) !== stableSettings(segment)
  const changes = useMemo<ReviewChange[]>(
    () => settingsReviewChanges(segment, draft),
    [draft, segment]
  )

  const saveMutation = useMutation({
    mutationFn: async (comment: string) => {
      const pending: Array<{
        field: "name" | "description" | "tags"
        request: Promise<boolean>
      }> = []
      if (segment.name !== draft.name) {
        pending.push({
          field: "name",
          request: updateSegmentName(envId, segment.id, draft.name, comment),
        })
      }
      if (segment.description !== draft.description) {
        pending.push({
          field: "description",
          request: updateSegmentDescription(
            envId,
            segment.id,
            draft.description,
            comment
          ),
        })
      }
      if (
        JSON.stringify([...segment.tags].sort()) !==
        JSON.stringify([...draft.tags].sort())
      ) {
        pending.push({
          field: "tags",
          request: updateSegmentTags(envId, segment.id, draft.tags, comment),
        })
      }
      const results = await Promise.allSettled(
        pending.map((item) => item.request)
      )
      const saved = { ...segment }
      const failed: string[] = []
      results.forEach((result, index) => {
        const field = pending[index].field
        if (result.status === "fulfilled") {
          if (field === "name") saved.name = draft.name
          if (field === "description") saved.description = draft.description
          if (field === "tags") saved.tags = draft.tags
        } else failed.push(field)
      })
      return { saved, failed }
    },
    onSuccess: ({ saved, failed }) => {
      onSaved(saved)
      setReviewOpen(false)
      if (failed.length) {
        toast.error(
          t("segments.detailsPage.settings.partialFailure", {
            fields: failed
              .map((field) => t(`segments.detailsPage.review.labels.${field}`))
              .join(", "),
          })
        )
      } else toast.success(t("segments.operationSucceeded"))
      if (
        !failed.includes("tags") &&
        JSON.stringify([...segment.tags].sort()) !==
          JSON.stringify([...draft.tags].sort())
      ) {
        void queryClient.invalidateQueries({
          queryKey: ["segment-tags", envId],
        })
      }
      void queryClient.invalidateQueries({ queryKey: ["segment-audit-logs"] })
    },
    onError: () => toast.error(t("segments.operationFailed")),
  })

  const tags = values.tags ?? []
  return (
    <form
      className="space-y-8 pt-4 pb-5"
      onSubmit={form.handleSubmit(() => setReviewOpen(true))}
    >
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium">
            {t("segments.detailsPage.settings.general")}
          </h2>
          <div className="flex items-center gap-4">
            {dirty ? (
              <span className="text-sm text-muted-foreground">
                {t("segments.detailsPage.unsavedChanges")}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || saveMutation.isPending}
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
            <Button type="submit" disabled={!dirty || saveMutation.isPending}>
              {t("segments.detailsPage.reviewAndSave")}
            </Button>
          </div>
        </div>
        <div className="max-w-3xl space-y-2">
          <Label htmlFor="segment-name">{t("segments.create.name")}</Label>
          <Input
            id="segment-name"
            disabled={!canUpdateName}
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
        <div className="max-w-3xl space-y-2">
          <Label htmlFor="segment-description">
            {t("segments.create.descriptionLabel")}
            <span className="font-normal text-muted-foreground">
              {` ${t("segments.detailsPage.optional")}`}
            </span>
          </Label>
          <Textarea
            id="segment-description"
            rows={4}
            disabled={!canUpdateDescription}
            {...form.register("description")}
          />
        </div>
      </section>

      <section className="max-w-3xl space-y-3">
        <h2 className="text-base font-medium">
          {t("segments.detailsPage.tags")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("segments.detailsPage.settings.tagsHelp")}
        </p>
        <SegmentTagPicker
          key={`${envId}-${segment.id}`}
          envId={envId}
          tags={tags}
          disabled={!canUpdateTags}
          onChange={(nextTags) =>
            form.setValue("tags", nextTags, { shouldDirty: true })
          }
        />
        <p className="text-xs text-muted-foreground">
          {t("segments.detailsPage.settings.tagInputHelp")}
        </p>
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
    </form>
  )
}
