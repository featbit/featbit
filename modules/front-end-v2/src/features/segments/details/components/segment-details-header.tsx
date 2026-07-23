import { ArrowLeft, Check, ChevronsUpDown, Copy, Flag } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Segment, SegmentFlagReference } from "../../segments-types"

type Props = {
  segment: Segment
  references: SegmentFlagReference[]
  activeTab: "targeting" | "settings" | "history"
  basePath: string
}

export function SegmentDetailsHeader({
  segment,
  references,
  activeTab,
  basePath,
}: Props) {
  const { t } = useTranslation()
  const [referencesOpen, setReferencesOpen] = useState(false)
  const tabs = ["targeting", "settings", "history"] as const

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(segment.key)
      toast.success(t("segments.copied"))
    } catch {
      toast.error(t("segments.operationFailed"))
    }
  }

  return (
    <>
      <header>
        <Link
          to={basePath}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("segments.title")}
        </Link>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-normal">
              {segment.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span>
                  {segment.type === "shared"
                    ? t("segments.shareable")
                    : t("segments.currentEnvironment")}
                </span>
                {segment.type === "shared" ? (
                  <>
                    <span aria-hidden>·</span>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto gap-1 p-0 font-normal"
                          />
                        }
                      >
                        {t("segments.detailsPage.scopeCount", {
                          count: segment.scopes.length,
                        })}
                        <ChevronsUpDown className="size-3.5" />
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-96 p-2">
                        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          {t("segments.sharedScopes")}
                        </p>
                        <div className="max-h-56 overflow-y-auto">
                          {segment.scopes.map((scope) => (
                            <div
                              key={scope}
                              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm"
                            >
                              <Check className="size-3.5 text-primary" />
                              <span className="truncate font-mono text-xs">
                                {scope}
                              </span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {t("segments.detailsPage.key")}
                </span>
                <div className="flex h-8 items-center gap-3 rounded-md border bg-muted/20 px-3 font-mono text-xs">
                  <span>{segment.key}</span>
                  <button
                    type="button"
                    aria-label={t("segments.copyKey", { key: segment.key })}
                    onClick={() => void copyKey()}
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
              {segment.tags.length ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {t("segments.detailsPage.tags")}
                  </span>
                  {segment.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="link"
            className="shrink-0"
            onClick={() => setReferencesOpen(true)}
          >
            {t("segments.detailsPage.flagReferences", {
              count: references.length,
            })}
          </Button>
        </div>
        <nav
          className="mt-6 flex border-b"
          aria-label={t("segments.detailsPage.tabsLabel")}
        >
          {tabs.map((tab) => (
            <Link
              key={tab}
              to={`${basePath}/${encodeURIComponent(segment.id)}/${tab}`}
              className={cn(
                "relative px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                activeTab === tab &&
                  "font-medium text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-foreground"
              )}
            >
              {t(`segments.detailsPage.tabs.${tab}`)}
            </Link>
          ))}
        </nav>
      </header>

      <Dialog open={referencesOpen} onOpenChange={setReferencesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("segments.references.title")}</DialogTitle>
            <DialogDescription>
              {t("segments.detailsPage.referencesDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {references.length ? (
              references.map((reference) => (
                <div
                  key={`${reference.envId}-${reference.id}`}
                  className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                >
                  <Flag className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {reference.name}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {reference.key}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("segments.detailsPage.noFlagReferences")}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
