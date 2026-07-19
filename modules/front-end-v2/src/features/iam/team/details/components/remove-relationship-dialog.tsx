import { useTranslation } from "react-i18next"
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
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            render={<Button type="button" variant="outline" />}
          >
            {t("iam.team.details.cancel")}
          </AlertDialogCancel>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
