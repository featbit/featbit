import { Copy } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { EndUser } from "../end-users-types"
import { SearchInput } from "./shared"

export function DetailsSheet({
  user,
  onOpenChange,
}: {
  user: EndUser | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 100)
    return () => window.clearTimeout(timeout)
  }, [search])

  const filter = debouncedSearch.trim().toLowerCase()
  const builtIn = useMemo(
    () =>
      [
        { name: "keyId", value: user?.keyId ?? "" },
        {
          name: "name",
          value: user?.name || t("endUsers.unnamed"),
        },
      ].filter((row) => matches(row, filter)),
    [filter, t, user?.keyId, user?.name]
  )
  const custom = useMemo(
    () =>
      (user?.customizedProperties ?? []).filter((row) => matches(row, filter)),
    [filter, user?.customizedProperties]
  )
  const hasMatches = builtIn.length > 0 || custom.length > 0

  function copy(value: string) {
    void navigator.clipboard.writeText(value)
    toast.success(t("endUsers.copied"))
  }

  return (
    <Sheet open={Boolean(user)} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,540px)] data-[side=right]:sm:max-w-[540px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>{t("endUsers.detailsDrawer.title")}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="truncate">
              {user?.name || t("endUsers.unnamed")}
            </span>
            <span>·</span>
            <span className="truncate font-mono">{user?.keyId}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7"
              onClick={() => user?.keyId && copy(user.keyId)}
            >
              <Copy className="size-3.5" />
            </Button>
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <SearchInput
            value={search}
            placeholder={t("endUsers.detailsDrawer.filter")}
            onChange={setSearch}
          />
          {!hasMatches ? (
            <div className="py-16 text-center">
              <p className="font-medium">
                {t("endUsers.detailsDrawer.noMatch")}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => setSearch("")}
              >
                {t("endUsers.clearSearch")}
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-7">
              {builtIn.length ? (
                <PropertyGroup
                  title={t("endUsers.detailsDrawer.builtIn")}
                  rows={builtIn}
                  onCopy={copy}
                />
              ) : null}
              {custom.length || !filter ? (
                <PropertyGroup
                  title={t("endUsers.detailsDrawer.custom")}
                  rows={custom}
                  empty={t("endUsers.detailsDrawer.noCustom")}
                  onCopy={copy}
                />
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function matches(row: { name: string; value: string }, filter: string) {
  return (
    !filter ||
    row.name.toLowerCase().includes(filter) ||
    row.value.toLowerCase().includes(filter)
  )
}

function PropertyGroup({
  title,
  rows,
  empty,
  onCopy,
}: {
  title: string
  rows: { name: string; value: string }[]
  empty?: string
  onCopy: (value: string) => void
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <dl className="mt-3 divide-y rounded-md border">
          {rows.map((row) => {
            return (
              <div
                key={row.name}
                className="grid grid-cols-[9rem_minmax(0,1fr)] gap-4 px-4 py-3 text-sm"
              >
                <dt className="font-medium text-muted-foreground">
                  {row.name}
                </dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{row.value || "—"}</span>
                  {row.value ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 shrink-0"
                      onClick={() => onCopy(row.value)}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  ) : null}
                </dd>
              </div>
            )
          })}
        </dl>
      ) : (
        <p className="mt-3 rounded-md border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  )
}
