import { Copy, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AccessToken } from "../access-token-types"

export type AccessTokenConfirmTarget = {
  kind: "deactivate" | "remove"
  token: AccessToken
} | null

export function AccessTokenConfirmDialog({
  target,
  saving,
  onOpenChange,
  onConfirm,
}: {
  target: AccessTokenConfirmTarget
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const removing = target?.kind === "remove"

  return (
    <AlertDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!saving) onOpenChange(open)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {removing
              ? t("accessTokens.confirm.removeTitle")
              : t("accessTokens.confirm.deactivateTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                {!removing
                  ? t("accessTokens.confirm.deactivateDescriptionBefore")
                  : null}
                <strong className="font-semibold text-foreground">
                  {target.token.name}
                </strong>
                {t(
                  removing
                    ? "accessTokens.confirm.removeDescriptionAfter"
                    : "accessTokens.confirm.deactivateDescriptionAfter"
                )}
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            {t("accessTokens.confirm.cancel")}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={removing ? "destructive" : "default"}
            disabled={saving}
            onClick={onConfirm}
          >
            {saving
              ? removing
                ? t("accessTokens.confirm.removing")
                : t("accessTokens.confirm.deactivating")
              : removing
                ? t("accessTokens.actions.remove")
                : t("accessTokens.actions.deactivate")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AccessTokenCreatedDialog({
  result,
  onClose,
}: {
  result: { name: string; token: string } | null
  onClose: () => void
}) {
  const { t } = useTranslation()

  async function copyToken() {
    if (!result) return

    try {
      await navigator.clipboard.writeText(result.token)
      toast.success(t("accessTokens.created.copied"))
    } catch {
      toast.error(t("accessTokens.created.copyFailed"))
    }
  }

  return (
    <Dialog
      open={Boolean(result)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("accessTokens.created.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("accessTokens.created.warning")}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <TriangleAlert className="size-4" />
          <AlertDescription>
            {t("accessTokens.created.warning")}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("accessTokens.created.tokenName")}
          </p>
          <p className="text-sm font-medium text-foreground">{result?.name}</p>
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
          <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground">
            {result?.token}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("accessTokens.created.copy")}
            onClick={() => void copyToken()}
          >
            <Copy className="size-4" />
          </Button>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="button" onClick={onClose}>
            {t("accessTokens.created.done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
