import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionContext,
} from "@codemirror/autocomplete"
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import { json } from "@codemirror/lang-json"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { linter, lintGutter } from "@codemirror/lint"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import { Compartment, EditorState } from "@codemirror/state"
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view"
import { Minimize2, Scan } from "lucide-react"
import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { codeMirrorEditorStyle } from "@/lib/code-mirror/editor-style"
import { validateJsonHandlebars } from "../webhook-utils"

const completionValues = [
  "@@flag.name",
  "@@flag.description",
  "events",
  "operator",
  "happenedAt",
  "changes",
  "organization.id",
  "organization.name",
  "project.id",
  "project.name",
  "environment.id",
  "environment.name",
  "data.kind",
  "data.object.id",
  "data.object.name",
]

function webhookCompletions(context: CompletionContext) {
  const word = context.matchBefore(/[@\w.]+/)
  if (!word || (word.from === word.to && !context.explicit)) return null
  return {
    from: word.from,
    options: completionValues.map((label) => ({ label, type: "variable" })),
  }
}

type Props = {
  value: string
  onChange: (value: string) => void
  readOnly: boolean
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

export function CodeMirrorTemplateEditor({
  value,
  onChange,
  readOnly,
  expanded,
  onExpandedChange,
}: Props) {
  const { t } = useTranslation()
  const embeddedHost = useRef<HTMLDivElement>(null)
  const expandedHost = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const editable = useRef(new Compartment())
  const initialValue = useRef(value)
  const initialReadOnly = useRef(readOnly)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!embeddedHost.current || viewRef.current) return
    const isDark = document.documentElement.classList.contains("dark")
    const state = EditorState.create({
      doc: initialValue.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ override: [webhookCompletions] }),
        highlightActiveLine(),
        highlightSelectionMatches(),
        json(),
        lintGutter(),
        linter(
          (view) => {
            const message = validateJsonHandlebars(view.state.doc.toString())
            return message
              ? [
                  {
                    from: 0,
                    to: Math.min(1, view.state.doc.length),
                    severity: "error" as const,
                    message,
                  },
                ]
              : []
          },
          { delay: 400 }
        ),
        keymap.of([
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
        ]),
        editable.current.of([
          EditorState.readOnly.of(initialReadOnly.current),
          EditorView.editable.of(!initialReadOnly.current),
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            onChangeRef.current(update.state.doc.toString())
        }),
        codeMirrorEditorStyle(isDark, { fillHeight: true }),
      ],
    })
    viewRef.current = new EditorView({
      state,
      parent: embeddedHost.current,
    })
    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }, [value])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    })
  }, [readOnly])

  useLayoutEffect(() => {
    const view = viewRef.current
    const host = expanded ? expandedHost.current : embeddedHost.current
    if (!view || !host) return
    host.appendChild(view.dom)
    view.requestMeasure()
    if (expanded) view.focus()
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onExpandedChange(false)
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [expanded, onExpandedChange])

  return (
    <>
      <div className="overflow-hidden rounded-md border bg-background">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">JSON Handlebars</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onExpandedChange(true)}
          >
            <Scan />
            {t("webhooks.editor.expand")}
          </Button>
        </div>
        <div ref={embeddedHost} className="h-60" />
      </div>

      {expanded
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="webhook-expanded-editor-title"
              className="fixed inset-0 z-[80] flex flex-col bg-background"
            >
              <div className="flex h-16 shrink-0 items-center gap-3 border-b px-6">
                <h2
                  id="webhook-expanded-editor-title"
                  className="text-lg font-semibold"
                >
                  {t("webhooks.editor.title")}
                </h2>
                <Badge variant="outline">
                  {t(
                    readOnly
                      ? "webhooks.template.default"
                      : "webhooks.template.custom"
                  )}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => onExpandedChange(false)}
                >
                  <Minimize2 />
                  {t("webhooks.editor.exit")}
                </Button>
              </div>
              <div
                ref={expandedHost}
                className="min-h-0 flex-1 bg-background"
              />
              <div className="flex h-8 shrink-0 items-center justify-between border-t bg-muted/30 px-4 text-xs text-muted-foreground">
                <span>JSON Handlebars</span>
                <span>{t("webhooks.editor.escapeHint")}</span>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
