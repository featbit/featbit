import { json } from "@codemirror/lang-json"
import { MergeView } from "@codemirror/merge"
import { EditorState } from "@codemirror/state"
import { EditorView, lineNumbers } from "@codemirror/view"
import { CircleMinus, CirclePlus } from "lucide-react"
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { codeMirrorEditorStyle } from "@/lib/code-mirror/editor-style"
import { cn } from "@/lib/utils"
import { auditObjectIdentity, auditTypeLabel } from "../audit-log-utils"
import type { AuditLog } from "../audit-logs-types"

function formattedJson(value?: string) {
  if (!value) return "{}"
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function RawDataDiff({
  auditLog,
  onReady,
}: {
  auditLog: AuditLog
  onReady: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const isDark = document.documentElement.classList.contains("dark")
    const readonly = [
      json(),
      lineNumbers(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      codeMirrorEditorStyle(isDark),
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
    let animationFrame = 0
    let attempts = 0
    let stableFrames = 0
    let previousSignature = ""
    let measurementsRemaining = 2

    const revealWhenStable = () => {
      const editors = Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(".cm-editor") ?? []
      )
      const spacers = Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          ".cm-mergeSpacer"
        ) ?? []
      )
      const signature = JSON.stringify({
        editors: editors.map((editor) => editor.offsetHeight),
        spacers: spacers.map((spacer) => spacer.offsetHeight),
      })

      attempts += 1
      stableFrames = signature === previousSignature ? stableFrames + 1 : 0
      previousSignature = signature

      if ((attempts >= 4 && stableFrames >= 2) || attempts >= 12) {
        onReady()
        return
      }
      animationFrame = window.requestAnimationFrame(revealWhenStable)
    }

    const measurementComplete = () => {
      measurementsRemaining -= 1
      if (measurementsRemaining === 0) {
        animationFrame = window.requestAnimationFrame(revealWhenStable)
      }
    }

    const measurement = {
      read: () => undefined,
      write: measurementComplete,
    }
    merge.a.requestMeasure(measurement)
    merge.b.requestMeasure(measurement)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      merge.destroy()
    }
  }, [auditLog, onReady])

  return (
    <div
      ref={containerRef}
      data-slot="raw-data-diff"
      className="min-h-0 overflow-hidden rounded-md border [&_.cm-editor]:max-h-[calc(78vh-11rem)] [&_.cm-mergeView]:max-h-[calc(78vh-11rem)] [&_.cm-mergeView]:overflow-auto [&_.cm-scroller]:max-h-[calc(78vh-11rem)]"
    />
  )
}

export function AuditLogRawDataDialog({
  auditLog,
  locale,
  onOpenChange,
}: {
  auditLog: AuditLog | null
  locale: string
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [readyAuditLogId, setReadyAuditLogId] = useState<string | null>(null)
  const contentReady = Boolean(auditLog && readyAuditLogId === auditLog.id)
  const handleDiffReady = useCallback(() => {
    if (auditLog) {
      setReadyAuditLogId(auditLog.id)
    }
  }, [auditLog])
  const identity = auditLog
    ? auditObjectIdentity(auditLog, t("auditLogs.unavailable"))
    : null
  const creator = auditLog
    ? auditLog.creatorName ||
      auditLog.creatorEmail ||
      auditLog.creatorId ||
      t("auditLogs.system")
    : ""
  const date = auditLog
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(auditLog.createdAt))
    : ""

  return (
    <Dialog
      open={Boolean(auditLog)}
      onOpenChange={(open) => {
        if (!open) setReadyAuditLogId(null)
        onOpenChange(open)
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[78vh] grid-rows-[auto_auto_auto] overflow-hidden sm:max-w-6xl",
          !contentReady && "invisible"
        )}
      >
        <DialogHeader>
          <DialogTitle>{t("auditLogs.rawData")}</DialogTitle>
          <DialogDescription>
            {auditLog && identity
              ? `${auditTypeLabel(auditLog.refType, t)} · ${identity.name} · ${date} · ${creator}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm font-medium">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <CircleMinus className="size-4 text-red-700 dark:text-red-400" />
            {t("auditLogs.previous")}
          </div>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <CirclePlus className="size-4 text-green-700 dark:text-green-400" />
            {t("auditLogs.current")}
          </div>
        </div>
        {auditLog ? (
          <RawDataDiff auditLog={auditLog} onReady={handleDiffReady} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
