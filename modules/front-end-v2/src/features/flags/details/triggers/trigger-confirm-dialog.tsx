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
import type { FlagTrigger } from "./triggers-api"

export type TriggerConfirmation =
  | { kind: "reset"; trigger: FlagTrigger }
  | { kind: "remove"; trigger: FlagTrigger }
  | null

export function TriggerConfirmDialog({
  target,
  saving,
  onOpenChange,
  onConfirm,
}: {
  target: TriggerConfirmation
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const kind = target?.kind ?? "reset"

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(`featureFlags.detailsPage.triggers.${kind}Title`)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(`featureFlags.detailsPage.triggers.${kind}Description`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("featureFlags.cancel")}
          </Button>
          <Button
            type="button"
            variant={kind === "remove" ? "destructive" : "default"}
            disabled={saving}
            onClick={onConfirm}
          >
            {saving
              ? t("featureFlags.detailsPage.triggers.working")
              : t(`featureFlags.detailsPage.triggers.${kind}`)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
