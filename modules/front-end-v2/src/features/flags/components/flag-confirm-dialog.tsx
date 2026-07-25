import { Loader2, MousePointerClick } from "lucide-react"
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
import { Input } from "@/components/ui/input"
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
  const [confirmationKey, setConfirmationKey] = useState("")
  if (!target) return null
  const archiveKeyMatches =
    target.kind !== "archive" || confirmationKey === target.flag.key
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
          ? {
              title: c.restoreTitle,
              body: (
                <>
                  {c.restoreBodyBefore}{" "}
                  <span className="rounded bg-muted px-1 py-0.5 font-mono font-medium text-foreground">
                    {target.flag.key}
                  </span>{" "}
                  {c.restoreBodyAfter}
                </>
              ),
              action: c.restore,
            }
          : {
              title: c.removeTitle,
              body: (
                <>
                  {c.removeBodyBefore}{" "}
                  <span className="rounded bg-muted px-1 py-0.5 font-mono font-medium text-foreground">
                    {target.flag.key}
                  </span>{" "}
                  {c.removeBodyAfter}
                </>
              ),
              action: c.remove,
            }

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
        {target.kind === "archive" ? (
          <div className="space-y-2">
            <p
              id="flag-archive-key-prompt"
              className="flex flex-wrap items-center gap-1.5 text-sm font-medium"
            >
              <span>{c.archiveKeyPromptBefore}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 border-primary/40 bg-primary/5 px-1.5 font-mono text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                disabled={saving}
                aria-label={c.useArchiveKey(target.flag.key)}
                onClick={() => setConfirmationKey(target.flag.key)}
              >
                <MousePointerClick className="size-3" />
                {target.flag.key}
              </Button>
              <span>{c.archiveKeyPromptAfter}</span>
            </p>
            <Input
              id="flag-archive-key"
              aria-labelledby="flag-archive-key-prompt"
              value={confirmationKey}
              placeholder={c.archiveKeyPlaceholder}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setConfirmationKey(event.target.value)}
            />
          </div>
        ) : null}
        <AlertDialogFooter className="border-t-0 bg-transparent">
          <AlertDialogCancel disabled={saving}>{c.cancel}</AlertDialogCancel>
          <Button
            type="button"
            variant={target.kind === "remove" ? "destructive" : "default"}
            disabled={
              saving ||
              !archiveKeyMatches ||
              (requireComment && !comment.trim())
            }
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
