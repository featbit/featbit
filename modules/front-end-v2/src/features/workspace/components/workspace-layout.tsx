import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { WorkspaceTabs } from "@/features/workspace/components/workspace-tabs"
import type { WorkspaceDetails } from "@/features/workspace/workspace-api"

function StatusToast({
  message,
  variant,
}: {
  message: string | null
  variant: "success" | "error"
}) {
  useEffect(() => {
    if (!message) {
      return
    }

    const options = { id: "workspace-status", duration: 2400 }
    if (variant === "error") {
      toast.error(message, options)
      return
    }

    toast.success(message, options)
  }, [message, variant])

  return null
}

export function WorkspaceLayout({
  workspace,
  lang,
  activeTab,
  statusMessage,
  statusVariant = "success",
  children,
}: {
  workspace: WorkspaceDetails | null
  lang: "en" | "zh"
  activeTab: string
  statusMessage?: string | null
  statusVariant?: "success" | "error"
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <StatusToast
        message={statusMessage ?? null}
        variant={statusVariant}
      />
      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("workspace.title")}
        </h1>
        {workspace ? (
          <p className="text-sm text-muted-foreground">
            {workspace.name} - {workspace.key}
          </p>
        ) : null}
      </header>

      <WorkspaceTabs lang={lang} activeTab={activeTab} />

      {children}
    </div>
  )
}
