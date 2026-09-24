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

export function BindingConfirmation({
  open,
  title,
  description,
  confirm,
  onCancel,
  onConfirm,
  pending = false,
}: {
  open: boolean
  title: string
  description: string
  confirm: string
  onCancel: () => void
  onConfirm: () => void
  pending?: boolean
}) {
  const { t } = useTranslation()
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !next && !pending && onCancel()}
    >
      <AlertDialogContent role="alertdialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            {t("releaseHealth.common.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
