import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import { json, jsonParseLinter } from "@codemirror/lang-json"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { linter, lintGutter } from "@codemirror/lint"
import { searchKeymap } from "@codemirror/search"
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
import { CircleAlert, CircleCheck } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { codeMirrorEditorStyle } from "@/lib/code-mirror/editor-style"

function getJsonError(
  value: string,
  t: ReturnType<typeof useTranslation>["t"]
) {
  if (!value.trim()) return t("featureFlags.jsonEditor.required")

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object") {
      return t("featureFlags.jsonEditor.objectOrArray")
    }
    return null
  } catch (error) {
    const detail =
      error instanceof SyntaxError
        ? error.message.replace(/^JSON\.parse:\s*/i, "")
        : t("featureFlags.jsonEditor.parseFailed")
    return t("featureFlags.jsonEditor.syntaxError", { detail })
  }
}

function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function compactJson(value: string) {
  return JSON.stringify(JSON.parse(value))
}

function JsonCodeMirror({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const initialValueRef = useRef(value)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentValue = view.state.doc.toString()
    if (currentValue === value) return

    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: value },
    })
  }, [value])

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return
    const theme = new Compartment()
    const isDark = document.documentElement.classList.contains("dark")
    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        json(),
        lintGutter(),
        linter(jsonParseLinter(), { delay: 250 }),
        keymap.of([
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
        ]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        theme.of(codeMirrorEditorStyle(isDark, { fillHeight: true })),
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    view.requestMeasure()
    view.focus()

    const observer = new MutationObserver(() => {
      view.dispatch({
        effects: theme.reconfigure(
          codeMirrorEditorStyle(
            document.documentElement.classList.contains("dark"),
            { fillHeight: true }
          )
        ),
      })
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => {
      observer.disconnect()
      view.destroy()
      viewRef.current = null
    }
  }, [])

  return (
    <div
      ref={hostRef}
      data-testid="flag-json-code-editor"
      className="h-[min(50vh,28rem)] min-h-72 overflow-hidden rounded-md border bg-background"
    />
  )
}

export function FlagJsonEditorDialog({
  open,
  variationName,
  value,
  onOpenChange,
  onApply,
}: {
  open: boolean
  variationName: string
  value: string
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => formatJson(value))

  const error = useMemo(() => getJsonError(draft, t), [draft, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("featureFlags.jsonEditor.title")}</DialogTitle>
          <DialogDescription>
            {t("featureFlags.jsonEditor.description", {
              name: variationName,
            })}
          </DialogDescription>
        </DialogHeader>

        {open ? <JsonCodeMirror value={draft} onChange={setDraft} /> : null}

        <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
          <div
            role="status"
            className={
              error
                ? "mr-auto flex min-w-0 items-center gap-2 text-xs text-destructive"
                : "mr-auto flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"
            }
          >
            {error ? (
              <CircleAlert className="size-4 shrink-0" />
            ) : (
              <CircleCheck className="size-4 shrink-0" />
            )}
            <span className="truncate">
              {error || t("featureFlags.jsonEditor.valid")}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(error)}
            onClick={() => {
              if (!error) setDraft(formatJson(draft))
            }}
          >
            {t("featureFlags.jsonEditor.format")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("featureFlags.jsonEditor.cancel")}
          </Button>
          <Button
            disabled={Boolean(error)}
            onClick={() => {
              if (!error) onApply(compactJson(draft))
            }}
          >
            {t("featureFlags.jsonEditor.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
