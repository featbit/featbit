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
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isWorkspace
              ? t("iam.team.remove.workspaceTitle")
              : t("iam.team.remove.organizationTitle")}
          </DialogTitle>
          <DialogDescription>
            {isWorkspace
              ? t("iam.team.remove.workspaceDescription")
              : t("iam.team.remove.organizationDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("iam.team.remove.cancel")}
          </DialogClose>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
