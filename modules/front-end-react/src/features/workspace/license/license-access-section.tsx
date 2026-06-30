import { Copy, LockKeyhole, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { WorkspaceDetails } from "../workspace-api";

function WorkspaceIdSection({ workspace, onCopied }: { workspace: WorkspaceDetails; onCopied: () => void }) {
  const { t } = useTranslation();

  async function copyWorkspaceId() {
    await navigator.clipboard.writeText(workspace.id);
    onCopied();
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("workspace.license.workspaceId")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("workspace.license.workspaceIdHelper")}</p>
        </div>
      </div>
      <div className="flex min-h-10 items-center gap-3 rounded-md border border-input bg-muted/50 px-3 py-2 dark:bg-muted/30">
        <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" />
        <code className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{workspace.id}</code>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2 bg-background" onClick={copyWorkspaceId}>
                <Copy className="h-4 w-4" />
                {t("workspace.license.copy")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.license.copyWorkspaceId")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function LicenseKeySection({
  value,
  setValue,
  canUpdate,
  isUpdating,
  onSubmit,
  currentLicense
}: {
  value: string;
  setValue: (value: string) => void;
  canUpdate: boolean;
  isUpdating: boolean;
  onSubmit: () => void;
  currentLicense?: string;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(!currentLicense);
  const hasCurrentLicense = Boolean(currentLicense);

  function maskLicense(license: string) {
    if (license.length <= 18) {
      return license;
    }

    return `${license.slice(0, 10)}...${license.slice(-8)}`;
  }

  function startEditing() {
    setValue("");
    setEditing(true);
  }

  function cancelEditing() {
    setValue(currentLicense ?? "");
    setEditing(false);
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex min-h-10 items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("workspace.license.licenseKey")}</h2>
          {hasCurrentLicense && !editing ? null : (
            <p className="mt-1 text-xs text-muted-foreground">{t("workspace.license.licenseKeyHelper")}</p>
          )}
        </div>
      </div>
      {hasCurrentLicense && !editing ? (
        <div className="flex min-h-10 items-center gap-3 rounded-md border border-input bg-muted/40 px-3 py-2 dark:bg-muted/20">
          <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <code className="block truncate text-sm font-semibold text-foreground">{maskLicense(currentLicense ?? "")}</code>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 bg-background" disabled={!canUpdate || isUpdating} onClick={startEditing}>
            {t("workspace.license.replace")}
          </Button>
        </div>
      ) : (
        <>
          <textarea
            className="min-h-16 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={value}
            disabled={!canUpdate || isUpdating}
            placeholder={t("workspace.license.licensePlaceholder")}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <div className="flex gap-2">
              {hasCurrentLicense ? (
                <Button type="button" variant="outline" disabled={isUpdating} onClick={cancelEditing}>
                  {t("workspace.license.cancel")}
                </Button>
              ) : null}
              <Button
                type="button"
                className="gap-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                disabled={!canUpdate || isUpdating || !value.trim()}
                onClick={onSubmit}
              >
                <Upload className="h-4 w-4" />
                {isUpdating ? t("workspace.license.updating") : t("workspace.license.update")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function LicenseAccessSection({
  workspace,
  licenseValue,
  setLicenseValue,
  canUpdateLicense,
  isUpdating,
  onCopied,
  onUpdateLicense
}: {
  workspace: WorkspaceDetails;
  licenseValue: string;
  setLicenseValue: (value: string) => void;
  canUpdateLicense: boolean;
  isUpdating: boolean;
  onCopied: () => void;
  onUpdateLicense: () => void;
}) {
  return (
    <section className="grid gap-4 pt-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <WorkspaceIdSection workspace={workspace} onCopied={onCopied} />
      <LicenseKeySection
        value={licenseValue}
        setValue={setLicenseValue}
        canUpdate={canUpdateLicense}
        isUpdating={isUpdating}
        onSubmit={onUpdateLicense}
        currentLicense={workspace.license}
      />
    </section>
  );
}
