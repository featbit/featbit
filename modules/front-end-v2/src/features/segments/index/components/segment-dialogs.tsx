import { ExternalLink } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { Segment, SegmentFlagReference } from "../../segments-types"

export type SegmentConfirmation = {
  kind: "archive" | "restore" | "remove"
  segment: Segment
} | null

export function SegmentConfirmDialog({
  target,
  requireComment,
  saving,
  onOpenChange,
  onConfirm,
}: {
  target: SegmentConfirmation
  requireComment: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
}) {
  const { t } = useTranslation()
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)
  if (!target) return null

  const titleKey = `segments.confirm.${target.kind}Title`
  const pendingKey = `segments.confirm.${
    target.kind === "archive"
      ? "archiving"
      : target.kind === "restore"
        ? "restoring"
        : "removing"
  }`
  const actionKey =
    target.kind === "archive"
      ? "segments.archive"
      : target.kind === "restore"
        ? "segments.restore"
        : "segments.remove"
  const commentInvalid = requireComment && !comment.trim()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!saving) onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>
            {target.kind === "restore"
              ? t("segments.confirm.restoreDescriptionBefore")
              : null}
            <strong className="font-semibold text-foreground">
              {target.segment.name}
            </strong>
            {t(`segments.confirm.${target.kind}DescriptionAfter`)}
          </DialogDescription>
        </DialogHeader>
        {requireComment ? (
          <div className="space-y-2">
            <Label htmlFor="segment-change-comment">
              {t("segments.confirm.comment")}
            </Label>
            <Textarea
              id="segment-change-comment"
              value={comment}
              disabled={saving}
              placeholder={t("segments.confirm.commentPlaceholder")}
              aria-invalid={submitted && commentInvalid}
              onChange={(event) => setComment(event.target.value)}
            />
            {submitted && commentInvalid ? (
              <p className="text-xs text-destructive">
                {t("segments.confirm.commentRequired")}
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("segments.confirm.cancel")}
          </Button>
          <Button
            type="button"
            variant={target.kind === "remove" ? "destructive" : "default"}
            disabled={saving}
            onClick={() => {
              setSubmitted(true)
              if (!commentInvalid) onConfirm(comment.trim())
            }}
          >
            {saving ? t(pendingKey) : t(actionKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SegmentReferencesDialog({
  references,
  segmentName,
  envId,
  lang,
  onClose,
}: {
  references: SegmentFlagReference[] | null
  segmentName: string
  envId: string
  lang: Lang
  onClose: () => void
}) {
  const { t } = useTranslation()
  if (!references) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("segments.references.title")}</DialogTitle>
          <DialogDescription>
            <strong className="font-semibold text-foreground">
              {segmentName}
            </strong>
            {t("segments.references.descriptionAfter")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {references.map((reference) => {
            const inCurrentEnvironment = reference.envId === envId
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {reference.name}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {reference.key}
                  </span>
                </span>
                {inCurrentEnvironment ? (
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("segments.references.outsideEnvironment")}
                  </span>
                )}
              </>
            )
            return inCurrentEnvironment ? (
              <Link
                key={`${reference.envId}-${reference.id}`}
                to={localizedPath(
                  lang,
                  `/feature-flags/${encodeURIComponent(reference.id)}/targeting`
                )}
                className="flex items-center gap-3 rounded-lg border px-3 py-1.5 hover:bg-muted"
              >
                {content}
              </Link>
            ) : (
              <div
                key={`${reference.envId}-${reference.id}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-1.5 opacity-70"
              >
                {content}
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("segments.references.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
