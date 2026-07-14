import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type RemoveDialogTarget = {
  kind: "group" | "policy" | "member"
  id: string
  name: string
} | null

export function RemoveRelationshipDialog({
  target,
  saving,
  onOpenChange,
  onConfirm,
}: {
  target: RemoveDialogTarget
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const title =
    target?.kind === "group"
      ? t("iam.team.details.removeGroupTitle")
      : target?.kind === "policy"
        ? t("iam.team.details.removePolicyTitle")
        : t("iam.team.details.removeMemberTitle")
  const description =
    target?.kind === "group" ? (
      <>
        {t("iam.team.details.removeGroupDescriptionBefore")}
        <strong className="font-semibold text-foreground">{target.name}</strong>
        {t("iam.team.details.removeGroupDescriptionAfter")}
      </>
    ) : target?.kind === "policy" ? (
      <>
        {t("iam.team.details.removePolicyDescriptionBefore")}
        <strong className="font-semibold text-foreground">{target.name}</strong>
        {t("iam.team.details.removePolicyDescriptionAfter")}
      </>
    ) : (
      t("iam.team.details.removeMemberDescription")
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
            {t("iam.team.details.cancel")}
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving
              ? t("iam.team.details.removing")
              : t("iam.team.details.remove")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
