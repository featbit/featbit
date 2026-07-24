import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { SegmentFlagReference } from "../segments-types"

export function SegmentReferencesDialog({
  references,
  segmentName,
  envId,
  lang,
  onClose,
}: {
  references: SegmentFlagReference[] | null
  segmentName: string
  envId: string
  lang: Lang
  onClose: () => void
}) {
  const { t } = useTranslation()
  if (!references) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("segments.references.title")}</DialogTitle>
          <DialogDescription>
            <strong className="font-semibold text-foreground">
              {segmentName}
            </strong>
            {t("segments.references.descriptionAfter")}
          </DialogDescription>
        </DialogHeader>
        {references.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {references.map((reference) => {
              const inCurrentEnvironment = reference.envId === envId
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {reference.name}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {reference.key}
                    </span>
                  </span>
                  {inCurrentEnvironment ? (
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("segments.references.outsideEnvironment")}
                    </span>
                  )}
                </>
              )

              return inCurrentEnvironment ? (
                <Link
                  key={`${reference.envId}-${reference.id}`}
                  to={localizedPath(
                    lang,
                    `/feature-flags/${encodeURIComponent(reference.key)}/targeting`
                  )}
                  className="flex items-center gap-3 rounded-lg border px-3 py-1.5 hover:bg-muted"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={`${reference.envId}-${reference.id}`}
                  className="flex items-center gap-3 rounded-lg border px-3 py-1.5 opacity-70"
                >
                  {content}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("segments.detailsPage.noFlagReferences")}
          </p>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("segments.references.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
