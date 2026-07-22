import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Webhook } from "../webhook-types"

export function RemoveWebhookDialog({
  target,
  isRemoving,
  onOpenChange,
  onConfirm,
}: {
  target: Webhook | null
  isRemoving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("webhooks.remove.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("webhooks.remove.description", { name: target?.name ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            disabled={isRemoving}
            onClick={() => onOpenChange(false)}
          >
            {t("webhooks.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={isRemoving}
            onClick={onConfirm}
          >
            {t(
              isRemoving
                ? "webhooks.remove.removing"
                : "webhooks.remove.confirm"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
