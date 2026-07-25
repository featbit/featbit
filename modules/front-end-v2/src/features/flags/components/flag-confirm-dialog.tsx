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
import type { Lang } from "@/features/layout/layout-types"
import { flagsCopy } from "../flags-copy"
import type { FeatureFlag } from "../flags-types"

export type FlagConfirmation = {
  kind: "toggle" | "archive" | "restore" | "remove"
  flag: FeatureFlag
  nextEnabled?: boolean
} | null

export function FlagConfirmDialog({
  lang,
  target,
  saving,
  requireComment,
  onOpenChange,
  onConfirm,
}: {
  lang: Lang
  target: FlagConfirmation
  saving: boolean
  requireComment: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
}) {
  const c = flagsCopy(lang)
  const [comment, setComment] = useState("")
  if (!target) return null
  const content =
    target.kind === "toggle"
      ? {
          title: c.toggleTitle(Boolean(target.nextEnabled)),
          body: c.toggleBody(Boolean(target.nextEnabled)),
          action: c.confirm,
        }
      : target.kind === "archive"
        ? {
            title: c.archiveTitle,
            body: c.archiveBody(target.flag.key),
            action: c.archive,
          }
        : target.kind === "restore"
          ? { title: c.restoreTitle, body: c.restoreBody, action: c.restore }
          : { title: c.removeTitle, body: c.removeBody, action: c.remove }

  return (
    <AlertDialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireComment ? (
          <div className="space-y-2">
            <Label htmlFor="flag-change-comment">
              {lang === "zh" ? "变更说明" : "Change comment"}
            </Label>
            <Textarea
              id="flag-change-comment"
              value={comment}
              placeholder={
                lang === "zh"
                  ? "说明此次变更的原因"
                  : "Explain why this change is needed"
              }
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{c.cancel}</AlertDialogCancel>
          <Button
            type="button"
            variant={target.kind === "remove" ? "destructive" : "default"}
            disabled={saving || (requireComment && !comment.trim())}
            onClick={() => onConfirm(comment.trim())}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {content.action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
