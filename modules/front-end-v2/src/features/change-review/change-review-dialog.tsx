import { useState } from "react"
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
import { ChangeLedger, type ChangeLedgerProps } from "./change-ledger"
import type {
  ChangeLedgerLayout,
  ChangeReviewItem,
} from "./change-review-types"

export type ChangeReviewDialogCopy = {
  title: string
  description: string
  changes: string
  changeCount: (count: number) => string
  comment: string
  optional: string
  commentPlaceholder: string
  commentHelp: string
  cancel: string
  save: string
  saving: string
}

type Props<TChange extends ChangeReviewItem> = {
  open: boolean
  idPrefix: string
  layout: Exclude<ChangeLedgerLayout, "history">
  changes: TChange[]
  requireComment: boolean
  saving: boolean
  copy: ChangeReviewDialogCopy
  ledger: Omit<ChangeLedgerProps<TChange>, "changes" | "layout">
  onOpenChange: (open: boolean) => void
  onSave: (comment: string) => void
}

export function ChangeReviewDialog<TChange extends ChangeReviewItem>({
  open,
  idPrefix,
  layout,
  changes,
  requireComment,
  saving,
  copy,
  ledger,
  onOpenChange,
  onSave,
}: Props<TChange>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ReviewDialogContent
          idPrefix={idPrefix}
          layout={layout}
          changes={changes}
          requireComment={requireComment}
          saving={saving}
          copy={copy}
          ledger={ledger}
          onClose={() => onOpenChange(false)}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  )
}

function ReviewDialogContent<TChange extends ChangeReviewItem>({
  idPrefix,
  layout,
  changes,
  requireComment,
  saving,
  copy,
  ledger,
  onClose,
  onSave,
}: Omit<Props<TChange>, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [comment, setComment] = useState("")

  return (
    <>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-medium">{copy.changes}</h3>
            <span className="text-sm text-muted-foreground">
              {copy.changeCount(changes.length)}
            </span>
          </div>
          <ChangeLedger changes={changes} layout={layout} {...ledger} />
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-change-comment`}>
              {copy.comment}
              {requireComment ? (
                <span className="ml-0.5 text-destructive">*</span>
              ) : (
                <span className="font-normal text-muted-foreground">
                  {` ${copy.optional}`}
                </span>
              )}
            </Label>
            <Textarea
              id={`${idPrefix}-change-comment`}
              value={comment}
              rows={3}
              placeholder={copy.commentPlaceholder}
              onChange={(event) => setComment(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{copy.commentHelp}</p>
          </div>
        </div>
        <DialogFooter className="border-t-0 bg-transparent">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            disabled={saving || (requireComment && !comment.trim())}
            onClick={() => onSave(comment.trim())}
          >
            {saving ? copy.saving : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  )
}
