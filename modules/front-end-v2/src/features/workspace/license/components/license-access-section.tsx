import { Copy, LockKeyhole, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { WorkspaceDetails } from "@/features/workspace/workspace-api"

function WorkspaceIdSection({
  workspace,
  onCopied,
}: {
  workspace: WorkspaceDetails
  onCopied: () => void
}) {
  const { t } = useTranslation()

  async function copyWorkspaceId() {
    await navigator.clipboard.writeText(workspace.id)
    onCopied()
  }

  return (
    <Card className="rounded-md shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold tracking-normal">
            {t("workspace.license.workspaceId")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("workspace.license.workspaceIdHelper")}
          </p>
        </div>
        <div className="flex min-h-10 items-center gap-3 rounded-md border bg-muted/50 px-3 py-2 dark:bg-muted/30">
          <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
          <code className="min-w-0 flex-1 truncate text-sm font-semibold">
            {workspace.id}
          </code>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2 bg-background"
                    onClick={copyWorkspaceId}
                  >
                    <Copy className="size-4" />
                    {t("workspace.license.copy")}
                  </Button>
                }
              />
              <TooltipContent>
                {t("workspace.license.copyWorkspaceId")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}

function LicenseKeySection({
  value,
  setValue,
  canUpdate,
  isUpdating,
  onSubmit,
  currentLicense,
}: {
  value: string
  setValue: (value: string) => void
  canUpdate: boolean
  isUpdating: boolean
  onSubmit: () => void
  currentLicense?: string
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(!currentLicense)
  const hasCurrentLicense = Boolean(currentLicense)

  function maskLicense(license: string) {
    if (license.length <= 18) {
      return license
    }

    return `${license.slice(0, 10)}...${license.slice(-8)}`
  }

  function startEditing() {
    setValue("")
    setEditing(true)
  }

  function cancelEditing() {
    setValue(currentLicense ?? "")
    setEditing(false)
  }

  return (
    <Card className="rounded-md shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold tracking-normal">
            {t("workspace.license.licenseKey")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasCurrentLicense && !editing
              ? "\u00A0"
              : t("workspace.license.licenseKeyHelper")}
          </p>
        </div>
        {hasCurrentLicense && !editing ? (
          <div className="flex min-h-10 items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 dark:bg-muted/20">
            <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
            <code className="min-w-0 flex-1 truncate text-sm font-semibold">
              {maskLicense(currentLicense ?? "")}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 bg-background"
              disabled={!canUpdate || isUpdating}
              onClick={startEditing}
            >
              {t("workspace.license.replace")}
            </Button>
          </div>
        ) : (
          <>
            <Textarea
              className="min-h-16 resize-y font-mono text-sm"
              value={value}
              disabled={!canUpdate || isUpdating}
              placeholder={t("workspace.license.licensePlaceholder")}
              onChange={(event) => setValue(event.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              {hasCurrentLicense ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={cancelEditing}
                >
                  {t("workspace.license.cancel")}
                </Button>
              ) : null}
              <Button
                type="button"
                className="gap-2"
                disabled={!canUpdate || isUpdating || !value.trim()}
                onClick={onSubmit}
              >
                <Upload className="size-4" />
                {isUpdating
                  ? t("workspace.license.updating")
                  : t("workspace.license.update")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function LicenseAccessSection({
  workspace,
  licenseValue,
  setLicenseValue,
  canUpdateLicense,
  isUpdating,
  onCopied,
  onUpdateLicense,
}: {
  workspace: WorkspaceDetails
  licenseValue: string
  setLicenseValue: (value: string) => void
  canUpdateLicense: boolean
  isUpdating: boolean
  onCopied: () => void
  onUpdateLicense: () => void
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
  )
}
