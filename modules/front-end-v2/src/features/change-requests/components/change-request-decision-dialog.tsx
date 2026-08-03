import { Loader2 } from "lucide-react"
import { useState } from "react"
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
import type { ChangeRequestsCopy } from "../change-requests-copy"

export function ChangeRequestDecisionDialog({
  action,
  requestTitle,
  saving,
  copy,
  onOpenChange,
  onConfirm,
}: {
  action: "approve" | "decline"
  requestTitle: string
  saving: boolean
  copy: ChangeRequestsCopy
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
}) {
  const [comment, setComment] = useState("")
  const declining = action === "decline"

  return (
    <AlertDialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {declining ? copy.declineDialogTitle : copy.approveDialogTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {copy.decisionDialogDescriptionBefore}
            <strong className="font-semibold text-foreground">
              {requestTitle}
            </strong>
            {copy.decisionDialogDescriptionAfter}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="change-request-decision-comment">
            {copy.decisionComment}
            {declining ? (
              <span className="text-destructive"> *</span>
            ) : (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({copy.optional})
              </span>
            )}
          </Label>
          <Textarea
            id="change-request-decision-comment"
            value={comment}
            placeholder={
              declining
                ? copy.declineCommentPlaceholder
                : copy.approveCommentPlaceholder
            }
            disabled={saving}
            autoFocus
            onChange={(event) => setComment(event.target.value)}
          />
          {declining ? (
            <p className="text-xs text-muted-foreground">
              {copy.declineCommentRequired}
            </p>
          ) : null}
        </div>
        <AlertDialogFooter className="border-t-0 bg-transparent">
          <AlertDialogCancel disabled={saving}>{copy.cancel}</AlertDialogCancel>
          <Button
            type="button"
            variant={declining ? "destructive" : "default"}
            disabled={saving || (declining && !comment.trim())}
            onClick={() => onConfirm(comment.trim())}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {declining ? copy.decline : copy.approve}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
