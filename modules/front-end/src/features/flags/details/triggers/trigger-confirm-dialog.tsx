import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  if (!target) return null
  const kind = target.kind

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>
            {t(`featureFlags.detailsPage.triggers.${kind}Title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`featureFlags.detailsPage.triggers.${kind}Description`)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t-0 bg-transparent">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
