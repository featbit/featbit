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
import type { Policy } from "../../policy-api"

export function RemovePolicyDialog({
  policy,
  saving,
  title,
  descriptionBefore,
  descriptionAfter,
  cancelLabel,
  confirmLabel,
  savingLabel,
  onOpenChange,
  onConfirm,
}: {
  policy: Policy | null
  saving: boolean
  title: string
  descriptionBefore: string
  descriptionAfter: string
  cancelLabel: string
  confirmLabel: string
  savingLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={Boolean(policy)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {descriptionBefore}
            <strong className="font-semibold text-foreground">
              {policy?.name}
            </strong>
            {descriptionAfter}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            render={<Button type="button" variant="outline" />}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? savingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
