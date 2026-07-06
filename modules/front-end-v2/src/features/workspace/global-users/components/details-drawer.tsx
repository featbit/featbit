import { Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { GlobalUser } from "../global-users-api"
import { DrawerShell } from "./dialog-shell"

export function DetailsDrawer({
  user,
  onClose,
  onCopied,
}: {
  user: GlobalUser | null
  onClose: () => void
  onCopied: () => void
}) {
  const { t } = useTranslation()
  const rows = [
    { name: "keyId", value: user?.keyId ?? "" },
    {
      name: "name",
      value: user?.name || t("workspace.globalUsers.unnamedUser"),
    },
  ]

  return (
    <DrawerShell
      open={Boolean(user)}
      title={t("workspace.globalUsers.details.title")}
      onClose={onClose}
    >
      <div className="space-y-7 px-6 py-5">
        <PropertySection
          title={t("workspace.globalUsers.details.builtIn")}
          rows={rows}
          onCopied={onCopied}
        />
        <PropertySection
          title={t("workspace.globalUsers.details.custom")}
          rows={user?.customizedProperties ?? []}
          empty={t("workspace.globalUsers.details.noCustomProperties")}
          alwaysShowCopy
          onCopied={onCopied}
        />
      </div>
    </DrawerShell>
  )
}

function PropertySection({
  title,
  rows,
  empty,
  alwaysShowCopy = false,
  onCopied,
}: {
  title: string
  rows: { name: string; value: string }[]
  empty?: string
  alwaysShowCopy?: boolean
  onCopied: () => void
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-md border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <dl className="mt-3 divide-y rounded-md border">
          {rows.map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[9rem_minmax(0,1fr)] gap-4 px-4 py-3 text-sm"
            >
              <dt className="font-medium text-muted-foreground">{row.name}</dt>
              <dd className="flex min-w-0 items-center gap-2 text-foreground">
                <span className="min-w-0 truncate">{row.value || "-"}</span>
                {row.value && (alwaysShowCopy || row.value.length > 12) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => {
                      void navigator.clipboard.writeText(row.value)
                      onCopied()
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
