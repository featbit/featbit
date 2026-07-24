import { render, screen, waitFor } from "@testing-library/react"
import { EditorState, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { AuditLog } from "../../segments-types"
import { RawDataDialog } from "./raw-data-dialog"

const mergeViewMock = vi.hoisted(() => vi.fn())

vi.mock("@codemirror/merge", () => ({
  MergeView: class {
    a = { requestMeasure: vi.fn() }
    b = { requestMeasure: vi.fn() }

    constructor(config: unknown) {
      mergeViewMock(config)
    }

    destroy() {}
  },
}))

const auditLog: AuditLog = {
  id: "audit-1",
  refId: "segment-1",
  refType: "Segment",
  operation: "Update",
  creatorId: "user-1",
  creatorName: "Alex Chen",
  creatorEmail: "alex@example.com",
  createdAt: "2026-07-23T08:42:00.000Z",
  comment: "",
  dataChange: {
    previous: '{"name":"Before","included":["user-1"]}',
    current: '{"name":"After","included":["user-1","user-2"]}',
  },
  instructions: [],
}

afterEach(() => {
  document.documentElement.classList.remove("dark")
})

beforeEach(() => {
  mergeViewMock.mockClear()
})

describe("RawDataDialog", () => {
  it("passes formatted previous and current snapshots to the merge view", async () => {
    render(<RawDataDialog auditLog={auditLog} onOpenChange={vi.fn()} />)

    await waitFor(() => expect(mergeViewMock).toHaveBeenCalledOnce())
    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[78vh]",
      "grid-rows-[auto_auto_auto]"
    )
    expect(screen.getByRole("dialog")).not.toHaveClass("h-[78vh]")
    expect(
      screen.getByText("Previous").querySelector(".lucide-circle-minus")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Current").querySelector(".lucide-circle-plus")
    ).toBeInTheDocument()

    const config = mergeViewMock.mock.calls[0][0] as {
      a: { doc: string }
      b: { doc: string }
    }
    expect(config.a.doc).toBe(
      JSON.stringify(JSON.parse(auditLog.dataChange.previous!), null, 2)
    )
    expect(config.b.doc).toBe(
      JSON.stringify(JSON.parse(auditLog.dataChange.current!), null, 2)
    )
  })

  it("uses CodeMirror's dark theme when the application is in dark mode", async () => {
    document.documentElement.classList.add("dark")

    render(<RawDataDialog auditLog={auditLog} onOpenChange={vi.fn()} />)

    await waitFor(() => expect(mergeViewMock).toHaveBeenCalledOnce())
    const config = mergeViewMock.mock.calls[0][0] as {
      a: { extensions: Extension }
    }
    const state = EditorState.create({ extensions: config.a.extensions })

    expect(state.facet(EditorView.darkTheme)).toBe(true)
  })
})
