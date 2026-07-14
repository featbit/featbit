import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function RemoveDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  savingLabel,
  saving,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description: ReactNode
  cancelLabel: string
  confirmLabel: string
  savingLabel: string
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
