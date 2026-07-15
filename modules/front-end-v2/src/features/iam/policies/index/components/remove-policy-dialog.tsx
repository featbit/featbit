import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
    <Dialog open={Boolean(policy)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {descriptionBefore}
            <strong className="font-semibold text-foreground">
              {policy?.name}
            </strong>
            {descriptionAfter}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? savingLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
