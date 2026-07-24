import { json } from "@codemirror/lang-json"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { MergeView } from "@codemirror/merge"
import { EditorState } from "@codemirror/state"
import { EditorView, lineNumbers } from "@codemirror/view"
import { tags } from "@lezer/highlight"
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

const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--cm-json-property)" },
  { tag: tags.string, color: "var(--cm-json-string)" },
  { tag: tags.number, color: "var(--cm-json-number)" },
  { tag: [tags.bool, tags.null], color: "var(--cm-json-literal)" },
  {
    tag: [tags.bracket, tags.separator],
    color: "var(--cm-json-punctuation)",
  },
])

const rawDataTheme = EditorView.theme({
  "&": {
    maxHeight: "calc(78vh - 11rem)",
    color: "var(--foreground)",
    backgroundColor: "var(--background)",
    "--cm-json-property": "#0451a5",
    "--cm-json-string": "#a31515",
    "--cm-json-number": "#098658",
    "--cm-json-literal": "#6f42c1",
    "--cm-json-punctuation": "var(--foreground)",
    "--cm-collapse-color": "var(--muted-foreground)",
    "--cm-collapse-background": "var(--muted)",
    "--cm-collapse-hover": "var(--accent)",
    "--cm-collapse-border": "var(--border)",
  },
  ".dark &": {
    color: "#d4d4d4",
    backgroundColor: "#1e1e1e",
    "--cm-json-property": "#9cdcfe",
    "--cm-json-string": "#ce9178",
    "--cm-json-number": "#b5cea8",
    "--cm-json-literal": "#c586c0",
    "--cm-json-punctuation": "#d4d4d4",
    "--cm-collapse-color": "#a6a6a6",
    "--cm-collapse-background": "#252526",
    "--cm-collapse-hover": "#2a2d2e",
    "--cm-collapse-border": "#333333",
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
      backgroundColor: "#3b2426",
    },
  ".dark &.cm-merge-b .cm-changedLine, .dark &.cm-merge-b .cm-changedLineGutter":
    {
      backgroundColor: "#20382a",
    },
  ".dark &.cm-merge-a .cm-changedText": {
    backgroundColor: "#5a2d31",
  },
  ".dark &.cm-merge-b .cm-changedText": {
    backgroundColor: "#275c38",
  },
  ".dark &.cm-merge-a .cm-changedLineGutter": {
    color: "#f48771",
    backgroundColor: "#512b2f",
    fontWeight: "700",
  },
  ".dark &.cm-merge-b .cm-changedLineGutter": {
    color: "#89d185",
    backgroundColor: "#244a31",
    fontWeight: "700",
  },
  ".dark & .cm-gutters": {
    color: "#858585",
    backgroundColor: "#181818",
    borderRightColor: "#333333",
  },
  ".cm-collapsedLines.cm-collapsedLines": {
    color: "var(--cm-collapse-color)",
    background: "var(--cm-collapse-background)",
    borderTop: "1px solid var(--cm-collapse-border)",
    borderBottom: "1px solid var(--cm-collapse-border)",
    boxShadow: "none",
    textShadow: "none",
  },
  ".cm-collapsedLines.cm-collapsedLines:hover": {
    color: "var(--foreground)",
    background: "var(--cm-collapse-hover)",
  },
  ".cm-collapsedLines.cm-collapsedLines::before, .cm-collapsedLines.cm-collapsedLines::after":
    {
      content: '"···"',
      color: "var(--cm-collapse-color)",
    },
  ".dark & .cm-selectionBackground, .dark &.cm-focused .cm-selectionBackground":
    {
      backgroundColor: "#264f78",
    },
})

function RawDataDiff({ auditLog }: { auditLog: AuditLog }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const isDark = document.documentElement.classList.contains("dark")
    const readonly = [
      json(),
      lineNumbers(),
      syntaxHighlighting(jsonHighlightStyle),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.darkTheme.of(isDark),
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
