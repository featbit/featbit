import { json } from "@codemirror/lang-json"
import { MergeView } from "@codemirror/merge"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AuditLog } from "../../segments-types"

function formattedJson(value?: string) {
  if (!value) return "{}"
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function RawDataDialog({
  auditLog,
  onOpenChange,
}: {
  auditLog: AuditLog | null
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!auditLog || !containerRef.current) return
    const readonly = [
      json(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
    ]
    const merge = new MergeView({
      parent: containerRef.current,
      a: {
        doc: formattedJson(auditLog.dataChange.previous),
        extensions: readonly,
      },
      b: {
        doc: formattedJson(auditLog.dataChange.current),
        extensions: readonly,
      },
      collapseUnchanged: { margin: 3, minSize: 4 },
      gutter: true,
      highlightChanges: true,
    })
    return () => merge.destroy()
  }, [auditLog])

  const creator =
    auditLog?.creatorName ||
    auditLog?.creatorEmail ||
    auditLog?.creatorId ||
    "—"
  const date = auditLog
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(auditLog.createdAt))
    : ""

  return (
    <Dialog open={Boolean(auditLog)} onOpenChange={onOpenChange}>
      <DialogContent className="h-[78vh] sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("segments.detailsPage.history.rawData")}</DialogTitle>
          <DialogDescription>
            {auditLog
              ? `${t("segments.detailsPage.history.events.segment")} · ${date} · ${creator}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm font-medium">
          <div className="rounded-md border px-3 py-2">
            {t("segments.detailsPage.history.previous")}
          </div>
          <div className="rounded-md border px-3 py-2">
            {t("segments.detailsPage.history.current")}
          </div>
        </div>
        <div
          ref={containerRef}
          className="min-h-0 overflow-hidden rounded-md border [&_.cm-editor]:h-[calc(78vh-11rem)] [&_.cm-editor]:text-xs [&_.cm-scroller]:overflow-auto"
        />
      </DialogContent>
    </Dialog>
  )
}
