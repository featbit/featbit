import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type DeleteTarget =
  | {
      type: "project"
      title: string
      description: string
      onConfirm: () => void | Promise<void>
    }
  | {
      type: "environment"
      title: string
      description: string
      onConfirm: () => void | Promise<void>
    }
  | {
      type: "secret"
      title: string
      description: string
      onConfirm: () => void | Promise<void>
    }

export function DeleteConfirmDialog({
  target,
  saving,
  cancelLabel,
  deleteLabel,
  onOpenChange,
}: {
  target: DeleteTarget | null
  saving: boolean
  cancelLabel: string
  deleteLabel: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{target?.title}</AlertDialogTitle>
          <AlertDialogDescription>{target?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" disabled={saving} />}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            render={<Button variant="destructive" disabled={saving} />}
            onClick={() => {
              void target?.onConfirm()
            }}
          >
            {deleteLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
