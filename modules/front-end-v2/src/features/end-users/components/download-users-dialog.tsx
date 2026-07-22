import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DownloadUsersDialog({
  open,
  downloading,
  limitExceeded,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  downloading: boolean
  limitExceeded: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[500px]">
        <DialogHeader className="px-6 py-5 pr-12">
          <DialogTitle>{t("endUsers.downloadDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("endUsers.downloadDialog.description")}
          </DialogDescription>
        </DialogHeader>
        {limitExceeded ? (
          <div className="mx-6 mb-5 rounded-md border border-destructive/20 bg-destructive/5 p-4">
            <p className="font-medium text-destructive">
              {t("endUsers.downloadDialog.limitTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("endUsers.downloadDialog.limitBody")}
            </p>
          </div>
        ) : null}
        <DialogFooter className="mx-0 mb-0 px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("endUsers.downloadDialog.cancel")}
          </Button>
          <Button
            type="button"
            disabled={downloading || limitExceeded}
            onClick={onConfirm}
          >
            {downloading ? <Loader2 className="animate-spin" /> : null}
            {t(
              downloading
                ? "endUsers.downloadDialog.downloading"
                : "endUsers.downloadDialog.continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
