import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { OrganizationTabs } from "@/features/organization/components/organization-tabs"
import type { OrganizationDetails } from "@/features/organization/organization-api"
import type { Lang } from "@/features/layout/layout-types"

function StatusToast({
  message,
  variant,
  eventId,
}: {
  message: string | null
  variant: "success" | "error"
  eventId?: number
}) {
  useEffect(() => {
    if (!message) {
      return
    }

    const options = { id: "organization-status", duration: 2400 }
    if (variant === "error") {
      toast.error(message, options)
      return
    }

    toast.success(message, options)
  }, [eventId, message, variant])

  return null
}

export function OrganizationLayout({
  organization,
  lang,
  activeTab,
  statusMessage,
  statusVariant = "success",
  statusEventId,
  children,
}: {
  organization: OrganizationDetails | null
  lang: Lang
  activeTab: string
  statusMessage?: string | null
  statusVariant?: "success" | "error"
  statusEventId?: number
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <StatusToast
        message={statusMessage ?? null}
        variant={statusVariant}
        eventId={statusEventId}
      />
      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("organization.title")}
        </h1>
        {organization ? (
          <p className="text-sm text-muted-foreground">
            {organization.name} - {organization.key}
          </p>
        ) : null}
      </header>

      <OrganizationTabs lang={lang} activeTab={activeTab} />

      {children}
    </div>
  )
}
