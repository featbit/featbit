import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
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

export function InsightCollectionDialog({
  enabled,
  flagName,
  requireComment,
  saving,
  onClose,
  onConfirm,
}: {
  enabled: boolean
  flagName: string
  requireComment: boolean
  saving: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
}) {
  const { t } = useTranslation()
  const [comment, setComment] = useState("")
  const commentId = useId()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              `featureFlags.detailsPage.settings.${enabled ? "enableCollectionTitle" : "disableCollectionTitle"}`
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              `featureFlags.detailsPage.settings.${enabled ? "enableCollectionDescription" : "disableCollectionDescription"}`,
              { name: flagName }
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="font-medium">
            {t("featureFlags.detailsPage.settings.collectionImpactTitle")}
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              {t(
                `featureFlags.detailsPage.settings.${enabled ? "enableCollectionImpact" : "disableCollectionImpact"}`
              )}
            </li>
            <li>
              {t(
                "featureFlags.detailsPage.settings.collectionEvaluationUnchanged"
              )}
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <Label htmlFor={commentId}>
            {t("featureFlags.detailsPage.review.comment")}
            {requireComment ? (
              <span className="text-destructive">*</span>
            ) : (
              <span className="font-normal text-muted-foreground">
                {t("featureFlags.detailsPage.review.optional")}
              </span>
            )}
          </Label>
          <Textarea
            id={commentId}
            rows={3}
            value={comment}
            disabled={saving}
            aria-required={requireComment}
            placeholder={t(
              "featureFlags.detailsPage.review.commentPlaceholder"
            )}
            onChange={(event) => setComment(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("featureFlags.detailsPage.review.commentHelp")}
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            {t("featureFlags.cancel")}
          </Button>
          <Button
            type="button"
            variant={enabled ? "default" : "destructive"}
            disabled={saving || (requireComment && !comment.trim())}
            onClick={() => onConfirm(comment.trim())}
          >
            {saving
              ? t("featureFlags.detailsPage.review.saving")
              : t(
                  `featureFlags.detailsPage.settings.${enabled ? "enableCollectionAction" : "disableCollectionAction"}`
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
