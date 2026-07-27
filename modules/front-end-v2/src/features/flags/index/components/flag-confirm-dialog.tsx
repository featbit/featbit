import { Loader2, MousePointerClick } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { FeatureFlag } from "../../flags-types"

export type FlagConfirmation = {
  kind: "toggle" | "archive" | "restore" | "remove"
  flag: FeatureFlag
  nextEnabled?: boolean
} | null

export function FlagConfirmDialog({
  target,
  saving,
  requireComment,
  onOpenChange,
  onConfirm,
}: {
  target: FlagConfirmation
  saving: boolean
  requireComment: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
}) {
  const { t } = useTranslation()
  const [comment, setComment] = useState("")
  const [confirmationKey, setConfirmationKey] = useState("")
  if (!target) return null
  const archiveKeyMatches =
    target.kind !== "archive" || confirmationKey === target.flag.key
  const content =
    target.kind === "toggle"
      ? {
          title: t(
            target.nextEnabled
              ? "featureFlags.toggleOnTitle"
              : "featureFlags.toggleOffTitle"
          ),
          body: t(
            target.nextEnabled
              ? "featureFlags.toggleOnBody"
              : "featureFlags.toggleOffBody"
          ),
          action: t("featureFlags.confirm"),
        }
      : target.kind === "archive"
        ? {
            title: t("featureFlags.archiveTitle"),
            body: t("featureFlags.archiveBody", { key: target.flag.key }),
            action: t("featureFlags.archive"),
          }
        : target.kind === "restore"
          ? {
              title: t("featureFlags.restoreTitle"),
              body: (
                <>
                  {t("featureFlags.restoreBodyBefore")}{" "}
                  <span className="rounded bg-muted px-1 py-0.5 font-mono font-medium text-foreground">
                    {target.flag.key}
                  </span>{" "}
                  {t("featureFlags.restoreBodyAfter")}
                </>
              ),
              action: t("featureFlags.restore"),
            }
          : {
              title: t("featureFlags.removeTitle"),
              body: (
                <>
                  {t("featureFlags.removeBodyBefore")}{" "}
                  <span className="rounded bg-muted px-1 py-0.5 font-mono font-medium text-foreground">
                    {target.flag.key}
                  </span>{" "}
                  {t("featureFlags.removeBodyAfter")}
                </>
              ),
              action: t("featureFlags.remove"),
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
              {t("featureFlags.changeComment")}
            </Label>
            <Textarea
              id="flag-change-comment"
              value={comment}
              placeholder={t("featureFlags.changeCommentPlaceholder")}
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
              <span>{t("featureFlags.archiveKeyPromptBefore")}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 border-primary/40 bg-primary/5 px-1.5 font-mono text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                disabled={saving}
                aria-label={t("featureFlags.useArchiveKey", {
                  key: target.flag.key,
                })}
                onClick={() => setConfirmationKey(target.flag.key)}
              >
                <MousePointerClick className="size-3" />
                {target.flag.key}
              </Button>
              <span>{t("featureFlags.archiveKeyPromptAfter")}</span>
            </p>
            <Input
              id="flag-archive-key"
              aria-labelledby="flag-archive-key-prompt"
              value={confirmationKey}
              placeholder={t("featureFlags.archiveKeyPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setConfirmationKey(event.target.value)}
            />
          </div>
        ) : null}
        <AlertDialogFooter className="border-t-0 bg-transparent">
          <AlertDialogCancel disabled={saving}>
            {t("featureFlags.cancel")}
          </AlertDialogCancel>
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
