import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { afterEach, describe, expect, it } from "vitest"
import { codeMirrorEditorStyle } from "./editor-style"

const views: EditorView[] = []

afterEach(() => {
  for (const view of views) view.destroy()
  views.length = 0
})

function createEditor(fillHeight = false) {
  const parent = document.createElement("div")
  document.body.appendChild(parent)
  const view = new EditorView({
    parent,
    state: EditorState.create({
      extensions: codeMirrorEditorStyle(false, { fillHeight }),
    }),
  })
  views.push(view)
  return view
}

describe("codeMirrorEditorStyle", () => {
  it("keeps content-driven height by default for merge views", () => {
    const view = createEditor()

    expect(getComputedStyle(view.dom).height).not.toBe("100%")
  })

  it("can fill a fixed-height editor host when explicitly requested", () => {
    const view = createEditor(true)

    expect(getComputedStyle(view.dom).height).toBe("100%")
  })

  it("keeps an empty merge spacer from inheriting the editor line height", () => {
    const view = createEditor()
    const spacer = document.createElement("div")
    spacer.className = "cm-mergeSpacer"
    spacer.contentEditable = "false"
    view.contentDOM.appendChild(spacer)

    expect(Number.parseFloat(getComputedStyle(spacer).lineHeight)).toBe(0)
    expect(spacer.getBoundingClientRect().height).toBe(0)
  })
})
