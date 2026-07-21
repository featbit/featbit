import { Check, Copy, KeyRound } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { RelayProxy } from "../relay-proxy-types"

export function RemoveRelayProxyDialog({
  target,
  isRemoving,
  onOpenChange,
  onConfirm,
}: {
  target: RelayProxy | null
  isRemoving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("relayProxies.removeDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                {t("relayProxies.removeDialog.descriptionBefore")}
                <strong className="font-semibold text-foreground">
                  {target.name}
                </strong>
                {t("relayProxies.removeDialog.descriptionAfter")}
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("relayProxies.removeDialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={isRemoving}
            onClick={onConfirm}
          >
            {t(
              isRemoving
                ? "relayProxies.removeDialog.removing"
                : "relayProxies.removeDialog.confirm"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function RelayProxyKeyDialog({
  relayProxy,
  onDone,
}: {
  relayProxy: RelayProxy | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  async function copyKey() {
    if (!relayProxy) return
    try {
      await navigator.clipboard.writeText(relayProxy.key)
      setCopied(true)
      setCopyFailed(false)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <Dialog open={Boolean(relayProxy)} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("relayProxies.keyDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("relayProxies.keyDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <KeyRound />
          <AlertTitle>{t("relayProxies.keyDialog.warningTitle")}</AlertTitle>
          <AlertDescription>
            {t("relayProxies.keyDialog.warning")}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Input readOnly value={relayProxy?.key ?? ""} className="font-mono" />
          <Button variant="outline" onClick={() => void copyKey()}>
            {copied ? <Check /> : <Copy />}
            {t(
              copied
                ? "relayProxies.keyDialog.copied"
                : "relayProxies.keyDialog.copy"
            )}
          </Button>
        </div>
        {copyFailed && (
          <p className="text-xs text-destructive">
            {t("relayProxies.keyDialog.copyFailed")}
          </p>
        )}
        <DialogFooter>
          <Button disabled={!copied} onClick={onDone}>
            {t("relayProxies.keyDialog.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
