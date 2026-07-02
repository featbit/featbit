import { FileJson, Loader2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { globalUsersTemplateUrl } from "../global-users-api";

const MAX_IMPORT_SIZE = 500 * 1024 * 1024;

export function ImportUsersModal({
  open,
  uploading,
  error,
  onClose,
  onImport
}: {
  open: boolean;
  uploading: boolean;
  error: string | null;
  onClose: () => void;
  onImport: (file: File) => void;
}) {
  const { t } = useTranslation();
  const [localError, setLocalError] = useState<string | null>(null);

  function validateAndImport(file: File | undefined) {
    setLocalError(null);
    if (!file) {
      return;
    }

    const isJson = file.type === "application/json" || file.name.toLowerCase().endsWith(".json");
    if (!isJson) {
      setLocalError(t("workspace.globalUsers.import.invalidType"));
      return;
    }

    if (file.size > MAX_IMPORT_SIZE) {
      setLocalError(t("workspace.globalUsers.import.tooLarge"));
      return;
    }

    onImport(file);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-[560px] p-0">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="truncate">{t("workspace.globalUsers.import.title")}</DialogTitle>
          <DialogDescription>{t("workspace.globalUsers.import.intro")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <a className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400" href={globalUsersTemplateUrl()} target="_blank" rel="noreferrer">
            <FileJson className="h-4 w-4" />
            {t("workspace.globalUsers.import.viewTemplate")}
          </a>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>{t("workspace.globalUsers.import.noteKey")}</li>
            <li>{t("workspace.globalUsers.import.noteProperties")}</li>
          </ul>
          <label
            className={cn(
              "flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-input bg-background px-6 py-8 text-center transition-colors hover:bg-accent",
              uploading && "pointer-events-none opacity-70"
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              validateAndImport(event.dataTransfer.files[0]);
            }}
          >
            {uploading ? <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> : <UploadCloud className="h-9 w-9 text-blue-600" />}
            <span className="mt-3 text-sm font-medium">{t("workspace.globalUsers.import.drop")}</span>
            <span className="mt-1 text-xs text-muted-foreground">{t("workspace.globalUsers.import.constraints")}</span>
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => validateAndImport(event.target.files?.[0])}
            />
          </label>
          {localError || error ? <p className="text-sm text-destructive">{localError ?? error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
