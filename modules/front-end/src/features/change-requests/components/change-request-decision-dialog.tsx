import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ChangeRequestDecisionDialog({
  action,
  requestTitle,
  saving,
  onOpenChange,
  onConfirm,
}: {
  action: "approve" | "decline"
  requestTitle: string
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
}) {
  const { t } = useTranslation()
  const [comment, setComment] = useState("")
  const declining = action === "decline"

  return (
    <AlertDialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(
              declining
                ? "changeRequests.declineDialogTitle"
                : "changeRequests.approveDialogTitle"
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("changeRequests.decisionDialogDescriptionBefore")}
            <strong className="font-semibold text-foreground">
              {requestTitle}
            </strong>
            {t("changeRequests.decisionDialogDescriptionAfter")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="change-request-decision-comment">
            {t("changeRequests.decisionComment")}
            {declining ? (
              <span className="text-destructive"> *</span>
            ) : (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({t("changeRequests.optional")})
              </span>
            )}
          </Label>
          <Textarea
            id="change-request-decision-comment"
            value={comment}
            placeholder={
              declining
                ? t("changeRequests.declineCommentPlaceholder")
                : t("changeRequests.approveCommentPlaceholder")
            }
            disabled={saving}
            autoFocus
            onChange={(event) => setComment(event.target.value)}
          />
          {declining ? (
            <p className="text-xs text-muted-foreground">
              {t("changeRequests.declineCommentRequired")}
            </p>
          ) : null}
        </div>
        <AlertDialogFooter className="border-t-0 bg-transparent">
          <AlertDialogCancel disabled={saving}>
            {t("changeRequests.cancel")}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={declining ? "destructive" : "default"}
            disabled={saving || (declining && !comment.trim())}
            onClick={() => onConfirm(comment.trim())}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {t(declining ? "changeRequests.decline" : "changeRequests.approve")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
