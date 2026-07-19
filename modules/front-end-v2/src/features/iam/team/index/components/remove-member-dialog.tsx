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
import type { TeamMember } from "../../team-api"

export type RemoveTarget = {
  member: TeamMember
  scope: "organization" | "workspace"
} | null

export function RemoveMemberDialog({
  target,
  saving,
  onOpenChange,
  onConfirm,
}: {
  target: RemoveTarget
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const isWorkspace = target?.scope === "workspace"

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isWorkspace
              ? t("iam.team.remove.workspaceTitle")
              : t("iam.team.remove.organizationTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isWorkspace
              ? t("iam.team.remove.workspaceDescription")
              : t("iam.team.remove.organizationDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            render={<Button type="button" variant="outline" />}
          >
            {t("iam.team.remove.cancel")}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving
              ? t("iam.team.remove.removing")
              : t("iam.team.remove.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
