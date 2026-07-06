import { Copy, LockKeyhole, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { WorkspaceDetails } from "@/features/workspace/workspace-api"
import { cn } from "@/lib/utils"

function CodeField({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg border bg-background px-2.5",
        className
      )}
    >
      {children}
    </div>
  )
}

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
    <div className="space-y-2">
      <div className="min-h-10">
        <h2 className="text-sm font-medium">
          {t("workspace.license.workspaceId")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("workspace.license.workspaceIdHelper")}
        </p>
      </div>
      <CodeField>
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
                  className="h-6 shrink-0 gap-1.5 bg-background px-2 text-xs"
                  onClick={copyWorkspaceId}
                >
                  <Copy className="size-3.5" />
                  {t("workspace.license.copy")}
                </Button>
              }
            />
            <TooltipContent>
              {t("workspace.license.copyWorkspaceId")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CodeField>
    </div>
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
    <div className="space-y-2">
      <div className="min-h-10">
        <h2 className="text-sm font-medium">
          {t("workspace.license.licenseKey")}
        </h2>
      </div>
      {hasCurrentLicense && !editing ? (
        <CodeField className="bg-muted/40 dark:bg-muted/20">
          <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
          <code className="min-w-0 flex-1 truncate text-sm font-semibold">
            {maskLicense(currentLicense ?? "")}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 shrink-0 bg-background px-2 text-xs"
            disabled={!canUpdate || isUpdating}
            onClick={startEditing}
          >
            {t("workspace.license.replace")}
          </Button>
        </CodeField>
      ) : (
        <CodeField>
          <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
          <Input
            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0"
            value={value}
            disabled={!canUpdate || isUpdating}
            placeholder={t("workspace.license.licensePlaceholder")}
            onChange={(event) => setValue(event.target.value)}
          />
          {hasCurrentLicense ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
            className="h-6 shrink-0 px-2 text-xs"
              disabled={isUpdating}
              onClick={cancelEditing}
            >
              {t("workspace.license.cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-6 shrink-0 gap-1.5 px-2 text-xs"
            disabled={!canUpdate || isUpdating || !value.trim()}
            onClick={onSubmit}
          >
            <Upload className="size-3.5" />
            {isUpdating
              ? t("workspace.license.updating")
              : t("workspace.license.update")}
          </Button>
        </CodeField>
      )}
    </div>
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
  licenseUpdateEventId,
}: {
  workspace: WorkspaceDetails
  licenseValue: string
  setLicenseValue: (value: string) => void
  canUpdateLicense: boolean
  isUpdating: boolean
  onCopied: () => void
  onUpdateLicense: () => void
  licenseUpdateEventId: number
}) {
  return (
    <section className="border-b py-8 first:pt-7">
      <div className="grid gap-5 lg:grid-cols-2">
      <WorkspaceIdSection workspace={workspace} onCopied={onCopied} />
      <LicenseKeySection
        key={licenseUpdateEventId}
        value={licenseValue}
        setValue={setLicenseValue}
        canUpdate={canUpdateLicense}
        isUpdating={isUpdating}
        onSubmit={onUpdateLicense}
        currentLicense={workspace.license}
      />
      </div>
    </section>
  )
}
