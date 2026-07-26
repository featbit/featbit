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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Lang } from "@/features/layout/layout-types"
import { codeMirrorEditorStyle } from "@/lib/code-mirror/editor-style"

function getJsonError(value: string, zh: boolean) {
  if (!value.trim()) return zh ? "请输入 JSON 值。" : "Enter a JSON value."

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object") {
      return zh
        ? "JSON 值必须是对象或数组。"
        : "The JSON value must be an object or array."
    }
    return null
  } catch (error) {
    const detail =
      error instanceof SyntaxError
        ? error.message.replace(/^JSON\.parse:\s*/i, "")
        : zh
          ? "无法解析 JSON。"
          : "Unable to parse JSON."
    return zh ? `JSON 语法错误：${detail}` : `JSON syntax error: ${detail}`
  }
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
  lang,
  variationName,
  value,
  onOpenChange,
  onApply,
}: {
  open: boolean
  lang: Lang
  variationName: string
  value: string
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
}) {
  const zh = lang === "zh"
  const [draft, setDraft] = useState(value)

  const error = useMemo(() => getJsonError(draft, zh), [draft, zh])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{zh ? "编辑 JSON 值" : "Edit JSON value"}</DialogTitle>
          <DialogDescription>
            {zh
              ? `正在编辑变体“${variationName}”。语法问题会直接标记在编辑器中。`
              : `Editing variation “${variationName}”. Syntax issues are marked directly in the editor.`}
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
              {error ||
                (zh ? "有效的 JSON 对象或数组" : "Valid JSON object or array")}
            </span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {zh ? "取消" : "Cancel"}
          </Button>
          <Button
            disabled={Boolean(error)}
            onClick={() => {
              if (!error) onApply(draft)
            }}
          >
            {zh ? "应用" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
