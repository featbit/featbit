import { FileJson, Loader2, UploadCloud } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadEndUsersTemplate } from "../end-users-api"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 500 * 1024 * 1024

export function ImportUsersDialog({
  open,
  importing,
  error,
  onOpenChange,
  onImport,
}: {
  open: boolean
  importing: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onImport: (file: File) => void
}) {
  const { t } = useTranslation()
  const [localError, setLocalError] = useState<string | null>(null)

  function validate(file?: File) {
    setLocalError(null)
    if (!file) return
    if (
      file.type !== "application/json" &&
      !file.name.toLowerCase().endsWith(".json")
    ) {
      setLocalError(t("endUsers.importDialog.invalidType"))
      return
    }
    if (file.size >= MAX_FILE_SIZE) {
      setLocalError(t("endUsers.importDialog.tooLarge"))
      return
    }
    onImport(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>{t("endUsers.importDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("endUsers.importDialog.intro")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            onClick={downloadEndUsersTemplate}
          >
            <FileJson className="size-4" />
            {t("endUsers.importDialog.template")}
          </button>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>{t("endUsers.importDialog.noteKey")}</li>
            <li>{t("endUsers.importDialog.noteProperties")}</li>
          </ul>
          <label
            className={cn(
              "flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-input px-6 py-8 text-center hover:bg-accent",
              importing && "pointer-events-none opacity-70"
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              validate(event.dataTransfer.files[0])
            }}
          >
            {importing ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : (
              <UploadCloud className="size-9 text-primary" />
            )}
            <span className="mt-3 text-sm font-medium">
              {t("endUsers.importDialog.drop")}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {t("endUsers.importDialog.constraints")}
            </span>
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={importing}
              onChange={(event) => validate(event.target.files?.[0])}
            />
          </label>
          {localError || error ? (
            <p className="text-sm text-destructive">{localError ?? error}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
