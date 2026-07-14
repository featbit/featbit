import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DetailsTranslations } from "./details-translations"

export type RemoveDialogTarget = {
  kind: "group" | "policy" | "member"
  id: string
  name: string
} | null

export function RemoveRelationshipDialog({
  target,
  saving,
  copy,
  onOpenChange,
  onConfirm,
}: {
  target: RemoveDialogTarget
  saving: boolean
  copy: DetailsTranslations
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const title =
    target?.kind === "group"
      ? copy.removeGroupTitle
      : target?.kind === "policy"
        ? copy.removePolicyTitle
        : copy.removeMemberTitle
  const description =
    target?.kind === "group" ? (
      <>
        {copy.removeGroupDescriptionBefore}
        <strong className="font-semibold text-foreground">{target.name}</strong>
        {copy.removeGroupDescriptionAfter}
      </>
    ) : target?.kind === "policy" ? (
      <>
        {copy.removePolicyDescriptionBefore}
        <strong className="font-semibold text-foreground">{target.name}</strong>
        {copy.removePolicyDescriptionAfter}
      </>
    ) : (
      copy.removeMemberDescription
    )

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {copy.cancel}
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? copy.removing : copy.remove}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
