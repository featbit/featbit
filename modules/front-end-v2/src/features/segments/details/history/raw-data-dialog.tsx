import { json } from "@codemirror/lang-json"
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { MergeView } from "@codemirror/merge"
import { EditorState } from "@codemirror/state"
import { EditorView, lineNumbers } from "@codemirror/view"
import { CircleMinus, CirclePlus } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
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

const rawDataTheme = EditorView.theme({
  "&": {
    maxHeight: "calc(78vh - 11rem)",
    color: "var(--foreground)",
    backgroundColor: "var(--background)",
  },
  ".cm-scroller": {
    overflow: "auto",
    maxHeight: "calc(78vh - 11rem)",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-content": {
    padding: "12px 0",
  },
  ".cm-gutters": {
    color: "var(--muted-foreground)",
    backgroundColor: "var(--muted)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px",
  },
  ".cm-changeGutter": {
    width: "20px",
    paddingLeft: "0",
  },
  "&.cm-merge-a .cm-changedLine": {
    backgroundColor: "var(--color-red-100)",
  },
  "&.cm-merge-b .cm-changedLine": {
    backgroundColor: "var(--color-green-200)",
  },
  "&.cm-merge-a .cm-changedText, &.cm-merge-b .cm-changedText": {
    background: "none",
  },
  "&.cm-merge-a .cm-changedLineGutter": {
    width: "20px",
    color: "var(--color-red-700)",
    backgroundColor: "var(--color-red-100)",
  },
  "&.cm-merge-b .cm-changedLineGutter": {
    width: "20px",
    color: "var(--color-green-700)",
    backgroundColor: "var(--color-green-200)",
  },
  "&.cm-merge-a .cm-changedLineGutter::after": {
    content: '"−"',
    display: "block",
    textAlign: "center",
  },
  "&.cm-merge-b .cm-changedLineGutter::after": {
    content: '"+"',
    display: "block",
    textAlign: "center",
  },
  ".dark &.cm-merge-a .cm-changedLine, .dark &.cm-merge-a .cm-changedLineGutter":
    {
      backgroundColor:
        "color-mix(in oklch, var(--destructive) 28%, var(--background))",
    },
  ".dark &.cm-merge-b .cm-changedLine, .dark &.cm-merge-b .cm-changedLineGutter":
    {
      backgroundColor:
        "color-mix(in oklch, var(--color-green-500) 28%, var(--background))",
    },
})

function RawDataDiff({ auditLog }: { auditLog: AuditLog }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const readonly = [
      json(),
      lineNumbers(),
      syntaxHighlighting(defaultHighlightStyle),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      rawDataTheme,
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
    merge.a.requestMeasure()
    merge.b.requestMeasure()
    return () => merge.destroy()
  }, [auditLog])

  return (
    <div
      ref={containerRef}
      className="min-h-0 overflow-hidden rounded-md border [&_.cm-editor]:text-xs [&_.cm-mergeView]:max-h-[calc(78vh-11rem)] [&_.cm-mergeView]:overflow-auto"
    />
  )
}

export function RawDataDialog({
  auditLog,
  onOpenChange,
}: {
  auditLog: AuditLog | null
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()

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
      <DialogContent className="max-h-[78vh] grid-rows-[auto_auto_auto] overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("segments.detailsPage.history.rawData")}</DialogTitle>
          <DialogDescription>
            {auditLog
              ? `${t("segments.detailsPage.history.events.segment")} · ${date} · ${creator}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm font-medium">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <CircleMinus className="size-4 text-red-700 dark:text-red-400" />
            {t("segments.detailsPage.history.previous")}
          </div>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <CirclePlus className="size-4 text-green-700 dark:text-green-400" />
            {t("segments.detailsPage.history.current")}
          </div>
        </div>
        {auditLog ? <RawDataDiff auditLog={auditLog} /> : null}
      </DialogContent>
    </Dialog>
  )
}
